import { computed, onMounted, shallowRef, triggerRef } from "vue";
import { openDB } from "idb";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { UploadState, S3Credentials, UploadJob, } from "@/modules/media/types/UploadStatus";
import { supabase } from "@/lib/supabaseClient";

/**
 * Persisted job (IndexedDB-safe)
 */
interface PersistedUploadJob {
  id: string;
  bucket: string;
  key: string;

  state: UploadState;
  progress: number;

  credentials: S3Credentials;

  fileMeta: {
    name: string;
    size: number;
    type: string;
  };

  updatedAt: number;
}

const MAX_CONCURRENT_UPLOADS = 3;
const DB_NAME = "upload-manager";
const STORE = "uploads";

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE, { keyPath: "id" });
  }
});

const uploads = shallowRef<UploadJob[]>([]);

const activeUploads = computed(() =>
  uploads.value.filter(u => u.state === "uploading")
);
const completedUploads = computed(() =>
  uploads.value.filter(u => u.state === "completed")
);

export async function buildUploadJob(
  file: globalThis.File,
  org_id: string,
  bucket: string
): Promise<UploadJob> {
  const response = await supabase.functions.invoke('get-wasabi-upload-session', {
    body: {
      org_id,
      bucket,
      file_name: file.name,
    }
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  const { credentials, storage_path, media_id } = response.data;

  return {
    id: media_id,
    bucket,
    storage_path,
    credentials,
    file,
    state: 'queued',
    progress: 0,
    _uploader: undefined
  };
};

/* =========================================================
 * Public API
 * ======================================================= */

export function useUploadManager() {
  onMounted(restoreFromDB);

  async function enqueue(job: UploadJob) {
    uploads.value.push(job);
    await persist(job);
    processQueue();
  }

  function pause(id: string) {
    const job: UploadJob | undefined = uploads.value.find(u => u.id === id);
    if (!job) return;

    job._uploader?.abort();
    job.state = "paused";
    persist(job);
    triggerRef(uploads);
  }

  function resume(id: string, file: File) {
    const job = uploads.value.find(u => u.id === id);
    if (!job) return;

    job.file = file;
    job.state = "queued";
    persist(job);
    triggerRef(uploads);
    processQueue();
  }

  function cancel(id: string) {
    const job = uploads.value.find(u => u.id === id);
    if (!job) return;

    job._uploader?.abort();
    job.state = "cancelled";
    persist(job);
    triggerRef(uploads);
  }

  function remove(id: string) {
    uploads.value = uploads.value.filter(u => u.id !== id);
    deleteFromDB(id);
  }

  return {
    uploads,
    activeUploads,
    completedUploads,
    enqueue,
    pause,
    resume,
    cancel,
    remove
  };
}

/* =========================================================
 * Queue Processing
 * ======================================================= */

function processQueue() {
  if (activeUploads.value.length >= MAX_CONCURRENT_UPLOADS) return;

  const next = uploads.value.find(
    u => u.state === "queued" && u.file
  );

  if (!next) return;

  startUpload(next);
}

/* =========================================================
 * Multipart Upload Execution
 * ======================================================= */

async function startUpload(job: UploadJob) {

  if (!job.file) {
    console.error('No file associated with upload job', job.id);
    job.state = "failed";
    persist(job);
    processQueue();
    return;
  }

  //TODO: Put in service
  const { error } = await supabase.from('media_assets').update({
    storage_path: job.storage_path,
    file_size_bytes: job.file.size,
    mime_type: job.file.type,
    duration_seconds: 0, //TODO!!
    checksum: 'TODO',
    status: 'uploading'
  }).eq('id', job.id);

  if (error) {
    console.error('Failed to update media asset status:', error);
  }

  job.state = "uploading";
  triggerRef(uploads);

  const client = new S3Client({
    region: "us-east-1",
    endpoint: "https://s3.wasabisys.com",
    credentials: job.credentials
  });

  const new_uploader = new Upload({
    client,
    params: {
      Bucket: job.bucket,
      Key: job.storage_path,
      Body: job.file!,
      ContentType: job.file!.type
    },
    queueSize: 4,
    partSize: 10 * 1024 * 1024,
    leavePartsOnError: true
  });

  job._uploader = new_uploader;

  new_uploader.on("httpUploadProgress", (e) => {
    if (e.total) {
      job.progress = Math.round((e.loaded! / e.total) * 100);
      persist(job);
      triggerRef(uploads);
    }
  });

  try {
    await new_uploader.done();
    job.state = "completed";
    job.progress = 100;
  } catch (err) {
    // State may have been changed to paused/cancelled during upload
    if (job.state === "uploading") {
      job.state = "failed";
    }
  } finally {
    job._uploader = undefined;
    persist(job);
    triggerRef(uploads);
    processQueue();
  }
}

/* =========================================================
 * Persistence
 * ======================================================= */

async function persist(job: UploadJob) {
  const db = await dbPromise;

  const persisted: PersistedUploadJob = {
    id: job.id,
    bucket: job.bucket,
    key: job.storage_path,
    state: job.state,
    progress: job.progress,
    credentials: job.credentials,
    fileMeta: {
      name: job.file?.name ?? "",
      size: job.file?.size ?? 0,
      type: job.file?.type ?? ""
    },
    updatedAt: Date.now()
  };

  await db.put(STORE, persisted);
}

async function restoreFromDB() {
  const db = await dbPromise;
  const stored = await db.getAll(STORE);

  uploads.value = stored.map((p): UploadJob => {
    const job: UploadJob = {
      id: p.id,
      bucket: p.bucket,
      storage_path: p.key,
      state: p.state === "uploading" ? "paused" : p.state,
      progress: p.progress,
      credentials: p.credentials,
      file: undefined,
      _uploader: undefined
    };
    return job;
  });
}

async function deleteFromDB(id: string) {
  const db = await dbPromise;
  await db.delete(STORE, id);
}

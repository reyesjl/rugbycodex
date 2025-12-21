import { computed, shallowRef, triggerRef } from "vue";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { UploadJob, } from "@/modules/media/types/UploadStatus";
import { supabase } from "@/lib/supabaseClient";
import { calculateFileChecksum, getMediaDurationSeconds, sanitizeFileName } from "@/modules/media/utils/assetUtilities";
import { mediaService } from "@/modules/media/services/mediaService";

const MAX_CONCURRENT_UPLOADS = 3;

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
  const duration_seconds = await getMediaDurationSeconds(file);
  console.log("Determined media duration (seconds):", duration_seconds);
  const response = await supabase.functions.invoke('get-wasabi-upload-session', {
    body: {
      org_id,
      bucket,
      file_name: sanitizeFileName(file.name),
      duration_seconds
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
  async function enqueue(job: UploadJob) {
    uploads.value.push(job);
    processQueue();
  }

  function pause(id: string) {
    const job: UploadJob | undefined = uploads.value.find(u => u.id === id);
    if (!job) return;

    job._uploader?.abort();
    job.state = "paused";
    triggerRef(uploads);
  }

  function resume(id: string, file: File) {
    const job = uploads.value.find(u => u.id === id);
    if (!job) return;

    job.file = file;
    job.state = "queued";
    triggerRef(uploads);
    processQueue();
  }

  function cancel(id: string) {
    const job = uploads.value.find(u => u.id === id);
    if (!job) return;

    job._uploader?.abort();
    job.state = "cancelled";
    triggerRef(uploads);
  }

  function remove(id: string) {
    uploads.value = uploads.value.filter(u => u.id !== id);
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
    processQueue();
    return;
  }

  job.state = "uploading";
  triggerRef(uploads);

  const checksum = await calculateFileChecksum(job.file);

  const { error } = await mediaService.updateMediaAsset(job.id, {
    storage_path: job.storage_path,
    file_size_bytes: job.file.size,
    mime_type: job.file.type,
    checksum: checksum,
    status: 'uploading'
  });

  if (error) {
    console.error('Failed to update media asset status:', error);
  }

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

  // Track upload start time
  const uploadStartTime = Date.now();

  new_uploader.on("httpUploadProgress", (e) => {
    if (e.total && e.loaded) {
      job.progress = Math.round((e.loaded / e.total) * 100);
      job.bytesUploaded = e.loaded;

      // Calculate average upload speed from start
      const elapsedSeconds = (Date.now() - uploadStartTime) / 1000;
      if (elapsedSeconds > 0) {
        job.uploadSpeedBps = e.loaded / elapsedSeconds; // bytes per second
      }

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
    triggerRef(uploads);
    processQueue();
  }
}



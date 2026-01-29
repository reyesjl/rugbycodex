import { computed, shallowRef, triggerRef, watch } from "vue";
import { defineStore } from "pinia";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { UploadJob, UploadJobMeta } from "@/modules/media/types/UploadStatus";
import { invokeEdge } from "@/lib/api";
import { handleEdgeFunctionError } from "@/lib/handleEdgeFunctionError";
import { getMediaDurationSeconds, sanitizeFileName } from "@/modules/media/utils/assetUtilities";
import { mediaService } from "@/modules/media/services/mediaService";
import { useActiveOrganizationStore } from "@/modules/orgs/stores/useActiveOrganizationStore";
import { useOrgMediaStore } from "@/modules/media/stores/useOrgMediaStore";
import { logInfo, logError, logEvent } from "@/lib/logger";

const MAX_CONCURRENT_UPLOADS = 3;
const MAX_QUEUED_UPLOADS = 5;
const STORAGE_KEY = "rugbycodex:upload-queue";

export const useUploadStore = defineStore("upload", () => {
  const activeOrganizationStore = useActiveOrganizationStore();

  const activeOrgId = computed(() => {
    const ctx = activeOrganizationStore.orgContext;
    return ctx && ctx.organization ? ctx.organization.id : null;
  });

  const storageKey = computed(() => (activeOrgId.value ? `${STORAGE_KEY}:${activeOrgId.value}` : STORAGE_KEY));

  const uploads = shallowRef<UploadJob[]>([]);

  const uploadsReadonly = computed(() => uploads.value);
  const activeUploads = computed(() => uploads.value.filter((u) => u.state === "uploading"));
  const completedUploads = computed(() => uploads.value.filter((u) => u.state === "completed"));

  async function buildUploadJob(file: globalThis.File, bucket: string): Promise<UploadJob> {
    const org_id = activeOrgId.value;
    if (!org_id) {
      throw new Error("No active organization selected.");
    }

    const duration_seconds = await getMediaDurationSeconds(file);
    const response = await invokeEdge("get-wasabi-upload-session", {
      body: {
        org_id,
        bucket,
        file_name: sanitizeFileName(file.name),
        file_size_bytes: file.size,
        duration_seconds,
      },
      orgScoped: true,
    });

    if (response.error) {
      throw await handleEdgeFunctionError(response.error, "Failed to create upload session.");
    }

    const { credentials, storage_path, media_id } = response.data;

    return {
      id: media_id,
      mediaId: media_id,
      orgId: org_id,
      fileName: sanitizeFileName(file.name),
      fileSize: file.size,
      bucket,
      storagePath: storage_path,
      credentials,
      file,
      state: "queued",
      progress: 0,
      createdAt: new Date().toISOString(),
      _uploader: undefined,
    };
  }

  async function startUpload(file: File, bucket: string): Promise<UploadJob> {
    const job = await buildUploadJob(file, bucket);
    enqueue(job);
    
    // Log upload initiated
    logInfo('Upload initiated', {
      media_id: job.mediaId,
      file_name: job.fileName,
      file_size: job.fileSize,
      bucket: job.bucket,
    });
    
    return job;
  }

  function persistQueue() {
    const meta: UploadJobMeta[] = uploads.value.map((job) => ({
      id: job.id,
      mediaId: job.mediaId,
      orgId: job.orgId,
      fileName: job.fileName,
      fileSize: job.fileSize,
      bucket: job.bucket,
      storagePath: job.storagePath,
      state: job.state,
      progress: job.progress,
      createdAt: job.createdAt,
      credentials: job.credentials,
    }));
    try {
      localStorage.setItem(storageKey.value, JSON.stringify(meta));
    } catch (err) {
      console.error("Failed to persist upload queue:", err);
    }
  }

  async function rehydrateQueue(): Promise<UploadJob[]> {
    try {
      const raw = localStorage.getItem(storageKey.value);
      if (!raw) return [];
      const meta: UploadJobMeta[] = JSON.parse(raw);

      const jobs = meta.map((m) => ({
        ...m,
        state: m.state === "uploading" ? ("abandoned" as const) : m.state,
        file: undefined,
        bytesUploaded: 0,
        uploadSpeedBps: 0,
        _uploader: undefined,
      }));

      // Sync database for abandoned uploads
      const abandonedJobs = jobs.filter((j) => j.state === "abandoned");
      for (const job of abandonedJobs) {
        try {
          await mediaService.updateMediaAsset(job.mediaId, {
            status: "interrupted",
          });
        } catch (err) {
          console.error(`Failed to mark ${job.mediaId} as interrupted:`, err);
        }
      }

      return jobs;
    } catch (err) {
      console.error("Failed to rehydrate upload queue:", err);
      return [];
    }
  }

  watch(
    activeOrgId,
    async (nextId, prevId) => {
      if (nextId === prevId) return;

      const inFlight = uploads.value.filter((job) => job.state === "uploading");
      if (inFlight.length > 0) {
        for (const job of inFlight) {
          job._uploader?.abort();
          job.state = "abandoned";
        }

        for (const job of inFlight) {
          try {
            await mediaService.updateMediaAsset(job.mediaId, {
              status: "interrupted",
            });
          } catch (err) {
            console.error(`Failed to mark ${job.mediaId} as interrupted:`, err);
          }
        }

        const meta: UploadJobMeta[] = uploads.value.map((job) => ({
          id: job.id,
          mediaId: job.mediaId,
          orgId: job.orgId,
          fileName: job.fileName,
          fileSize: job.fileSize,
          bucket: job.bucket,
          storagePath: job.storagePath,
          state: job.state,
          progress: job.progress,
          createdAt: job.createdAt,
          credentials: job.credentials,
        }));

        const previousStorageKey = prevId ? `${STORAGE_KEY}:${prevId}` : STORAGE_KEY;
        try {
          localStorage.setItem(previousStorageKey, JSON.stringify(meta));
        } catch (err) {
          console.error("Failed to persist upload queue:", err);
        }

        triggerRef(uploads);
      }

      uploads.value = [];
      triggerRef(uploads);

      const jobs = await rehydrateQueue();
      uploads.value = jobs;
      triggerRef(uploads);
    },
    { immediate: true },
  );

  watch(
    uploads,
    () => {
      persistQueue();
    },
    { deep: true },
  );

  watch(
    () => completedUploads.value,
    async (completed) => {
      if (completed.length === 0) return;

      const jobs = [...completed];

      // Complete upload: verify, create job, and dispatch to SQS
      await Promise.all(
        jobs.map(async (job) => {
          try {
            console.log(`[Upload] Completing upload for media ${job.id}...`);
            
            const response = await invokeEdge("complete-upload", {
              body: {
                media_id: job.id,
                org_id: job.orgId,
                storage_path: job.storagePath,
              },
              orgScoped: true,
            });

            if (response.error) {
              console.error(`[Upload] Failed to complete upload for media ${job.id}:`, response.error);
            } else {
              console.log(
                `[Upload] Successfully completed upload for media ${job.id} - ` +
                `job ${response.data?.job_id} dispatched (message: ${response.data?.message_id})`
              );
            }
          } catch (err) {
            console.error(`[Upload] Exception completing upload for media ${job.id}:`, err);
          }
        })
      );

      // Clean up completed jobs from upload queue
      for (const job of jobs) {
        remove(job.id);
      }

      // Refresh media list
      const orgMediaStore = useOrgMediaStore();
      orgMediaStore.reset();
      void orgMediaStore.loadForActiveOrg();
    },
  );

  function enqueue(job: UploadJob) {
    const inFlight = uploads.value.filter((u) => u.state === "uploading").length;
    const totalQueued = uploads.value.filter((u) => u.state === "queued" || u.state === "uploading").length;

    if (inFlight >= MAX_CONCURRENT_UPLOADS && totalQueued >= MAX_QUEUED_UPLOADS) {
      throw new Error(
        `Upload limit reached. Maximum ${MAX_QUEUED_UPLOADS} uploads allowed (${MAX_CONCURRENT_UPLOADS} concurrent).`,
      );
    }

    if (totalQueued >= MAX_QUEUED_UPLOADS) {
      throw new Error(`Upload queue full. Maximum ${MAX_QUEUED_UPLOADS} uploads allowed.`);
    }

    uploads.value.push(job);
    persistQueue();
    processQueue();
  }

  function reattachFile(id: string, file: File) {
    const job = uploads.value.find((u) => u.id === id);
    if (!job) return;

    if (job.state !== "abandoned") {
      throw new Error("Can only reattach files to abandoned uploads.");
    }

    job.file = file;
    job.state = "queued";
    job.progress = 0;
    job.bytesUploaded = 0;
    job.uploadSpeedBps = 0;
    persistQueue();
    triggerRef(uploads);
    processQueue();
  }

  function cancel(id: string) {
    const job = uploads.value.find((u) => u.id === id);
    if (!job) return;

    job._uploader?.abort();
    job.state = "failed";
    persistQueue();
    triggerRef(uploads);
  }

  function remove(id: string) {
    uploads.value = uploads.value.filter((u) => u.id !== id);
    persistQueue();
  }

  function clearCompleted() {
    uploads.value = uploads.value.filter((u) => u.state !== "completed");
    persistQueue();
  }

  function clearFailed() {
    uploads.value = uploads.value.filter((u) => u.state !== "failed");
    persistQueue();
  }

  /* =========================================================
   * Queue Processing
   * ======================================================= */

  function processQueue() {
    const inFlight = activeUploads.value.length;
    if (inFlight >= MAX_CONCURRENT_UPLOADS) return;

    const available = MAX_CONCURRENT_UPLOADS - inFlight;
    const queued = uploads.value.filter((u) => u.state === "queued" && u.file);

    for (let i = 0; i < Math.min(available, queued.length); i++) {
      const job = queued[i];
      if (job) {
        executeUpload(job);
      }
    }
  }

  /* =========================================================
   * Multipart Upload Execution
   * ======================================================= */

  async function executeUpload(job: UploadJob) {
    if (!job.file) {
      console.error("No file associated with upload job", job.id);
      job.state = "failed";
      persistQueue();
      triggerRef(uploads);
      processQueue();
      return;
    }

    if (job.state !== "queued") {
      console.warn("Attempted to start non-queued job", job.id, job.state);
      return;
    }

    job.state = "uploading";
    persistQueue();
    triggerRef(uploads);

    console.log(JSON.stringify({
      severity: "info",
      event_type: "upload_start",
      media_id: job.mediaId,
      org_id: job.orgId,
      file_name: job.fileName,
      file_size_bytes: job.fileSize,
    }));

    // Log to Axiom
    logEvent('info', 'upload_start', {
      media_id: job.mediaId,
      file_name: job.fileName,
      file_size_bytes: job.fileSize,
      bucket: job.bucket,
    });

    console.log(JSON.stringify({
      severity: "info",
      event_type: "metric",
      metric_name: "frontend_media_upload_duration_ms",
      metric_value: 0,
      tags: { org_id: job.orgId },
    }));

    const { error } = await mediaService.updateMediaAsset(job.id, {
      storage_path: job.storagePath,
      file_size_bytes: job.file.size,
      mime_type: job.file.type,
      checksum: "TODO",
      status: "uploading",
    });

    if (error) {
      console.error("Failed to update media asset status:", error);
      job.state = "failed";
      persistQueue();
      triggerRef(uploads);
      processQueue();
      return;
    }

    const client = new S3Client({
      region: "us-east-1",
      endpoint: "https://s3.wasabisys.com",
      credentials: job.credentials,
    });

    const uploader = new Upload({
      client,
      params: {
        Bucket: job.bucket,
        Key: job.storagePath,
        Body: job.file,
        ContentType: job.file.type,
      },
      queueSize: 4,
      partSize: 10 * 1024 * 1024,
      leavePartsOnError: true,
    });

    job._uploader = uploader;

    const uploadStartTime = Date.now();

    uploader.on("httpUploadProgress", (e) => {
      if (e.total && e.loaded) {
        job.progress = Math.round((e.loaded / e.total) * 100);
        job.bytesUploaded = e.loaded;

        const elapsedSeconds = (Date.now() - uploadStartTime) / 1000;
        if (elapsedSeconds > 0) {
          job.uploadSpeedBps = e.loaded / elapsedSeconds;
        }

        if (job.progress % 25 === 0) {
          console.log(JSON.stringify({
            severity: "info",
            event_type: "upload_progress",
            media_id: job.mediaId,
            org_id: job.orgId,
            progress: job.progress,
            bytes_uploaded: job.bytesUploaded,
          }));
        }

        persistQueue();
        triggerRef(uploads);
      }
    });

    try {
      await uploader.done();
      job.state = "completed";
      job.progress = 100;
      persistQueue();

      const uploadDurationMs = Date.now() - uploadStartTime;
      const throughputMbps = (job.fileSize / 1024 / 1024) / (uploadDurationMs / 1000);

      console.log(JSON.stringify({
        severity: "info",
        event_type: "upload_success",
        media_id: job.mediaId,
        org_id: job.orgId,
      }));

      // Log to Axiom
      logInfo('Upload completed successfully', {
        media_id: job.mediaId,
        file_name: job.fileName,
        file_size_bytes: job.fileSize,
        duration_ms: uploadDurationMs,
        throughput_mbps: throughputMbps.toFixed(2),
      });

    } catch (err) {
      console.error("Upload failed for job", job.id, err);
      console.log(JSON.stringify({
        severity: "error",
        event_type: "upload_failure",
        media_id: job.mediaId,
        org_id: job.orgId,
        error_code: "WASABI_UPLOAD_FAILED",
        error_message: err instanceof Error ? err.message : String(err),
      }));

      // Log to Axiom
      logError('Upload failed', err, {
        media_id: job.mediaId,
        file_name: job.fileName,
        file_size_bytes: job.fileSize,
        error_code: 'WASABI_UPLOAD_FAILED',
      });
      console.log(JSON.stringify({
        severity: "error",
        event_type: "metric",
        metric_name: "frontend_media_upload_failures_total",
        metric_value: 1,
        tags: { reason: "WASABI_UPLOAD_FAILED" },
      }));
      if (job.state === "uploading") {
        job.state = "failed";
        persistQueue();
      }
    } finally {
      const elapsedMs = Date.now() - uploadStartTime;
      console.log(JSON.stringify({
        severity: "info",
        event_type: "metric",
        metric_name: "frontend_media_upload_duration_ms",
        metric_value: elapsedMs,
        tags: { org_id: job.orgId },
      }));
      job._uploader = undefined;
      triggerRef(uploads);
      processQueue();
    }
  }

  return {
    uploadsReadonly,
    activeUploads,
    completedUploads,
    buildUploadJob,
    startUpload,
    enqueue,
    reattachFile,
    cancel,
    remove,
    clearCompleted,
    clearFailed,
  };
});

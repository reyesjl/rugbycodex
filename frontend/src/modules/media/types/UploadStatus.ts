import { Upload } from "@aws-sdk/lib-storage";

export type UploadState =
  | "queued"
  | "uploading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiresAt: string;
}

/**
 * Runtime-only job (used by Vue + AWS SDK)
 */
export interface UploadJob {
  id: string;
  bucket: string;
  storage_path: string;

  file?: File;

  state: UploadState;
  progress: number;

  // Speed tracking
  bytesUploaded?: number;
  uploadSpeedBps?: number; // bytes per second

  credentials: S3Credentials;

  // Runtime-only (NEVER persisted)
  _uploader?: Upload;
}


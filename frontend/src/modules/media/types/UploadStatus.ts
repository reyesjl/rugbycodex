import { Upload } from "@aws-sdk/lib-storage";

export type UploadState =
  | "queued"
  | "uploading"
  | "completed"
  | "failed"
  | "abandoned";

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiresAt: string;
}

/**
 * Persistable upload job metadata
 */
export interface UploadJobMeta {
  id: string;
  mediaId: string;
  orgId: string;
  fileName: string;
  fileSize: number;
  bucket: string;
  storagePath: string;
  state: UploadState;
  progress: number;
  createdAt: string;
  credentials: S3Credentials;
}

/**
 * Runtime job (includes File reference)
 */
export interface UploadJob extends UploadJobMeta {
  file?: File;
  bytesUploaded?: number;
  uploadSpeedBps?: number;
  _uploader?: Upload;
}


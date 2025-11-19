/** Minimal media asset metadata tied to an organization. */
export type OrgMediaAsset = {
  id: string;
  org_id: string;
  uploader_id: string;
  bucket: string;
  storage_path: string;
  file_size_bytes: number;
  mime_type: string;
  duration_seconds: number;
  checksum: string;
  source: string;
  file_name: string;
  status: string;
  created_at: Date;
};
import type { Bytes } from "./Bytes";
import type { MediaAssetStatus } from "./MediaAssetStatus";
import type { OrgId } from "./OrgId";
import type { UUID } from "./UUID";
import type { UserId } from "./UserId";

export type OrgMediaAssetSummary = {
  id: UUID;
  org_id: OrgId;
  uploader_id: UserId;
  bucket: string;
  storage_path: string;
  file_name: string;
  file_size_bytes: Bytes;
  mime_type: string;
  duration_seconds: number;
  status: MediaAssetStatus;
  created_at: Date;
};

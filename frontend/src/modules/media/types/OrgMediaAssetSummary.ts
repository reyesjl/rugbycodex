import type { Bytes } from "../../orgs/types/Bytes";
import type { MediaAssetKind } from "./MediaAssetKind";
import type { MediaAssetStatus } from "./MediaAssetStatus";
import type { OrgId } from "../../orgs/types/OrgId";
import type { UUID } from "../../orgs/types/UUID";
import type { UserId } from "../../orgs/types/UserId";

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
  kind: MediaAssetKind;
  status: MediaAssetStatus;
  created_at: Date;
};

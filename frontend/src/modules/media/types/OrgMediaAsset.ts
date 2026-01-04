import type { Bytes } from "@/modules/orgs/types/Bytes";
import type { MediaAssetKind } from "@/modules/media/types/MediaAssetKind";
import type { MediaAssetStatus } from "@/modules/media/types/MediaAssetStatus";
import type { OrgId } from "@/modules/orgs/types/OrgId";
import type { UUID } from "@/modules/orgs/types/UUID";
import type { UserId } from "@/modules/orgs/types/UserId";

export type OrgMediaAsset = {
  id: UUID;
  org_id: OrgId;
  uploader_id: UserId;
  bucket: string;
  storage_path: string;
  file_size_bytes: Bytes;
  mime_type: string;
  duration_seconds: number;
  checksum: string;
  source: string;
  file_name: string;
  kind: MediaAssetKind;
  status: MediaAssetStatus;
  created_at: Date;
  base_org_storage_path: string;
};

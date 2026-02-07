import type { UUID } from '@/modules/orgs/types/UUID';
import type { OrgId } from '@/modules/orgs/types/OrgId';
import type { UserId } from '@/modules/orgs/types/UserId';
import type { MediaAssetStatus } from './MediaAssetStatus';
import type { MediaAssetKind } from './MediaAssetKind';

/**
 * Admin list item for media assets with aggregated details
 */
export type AdminMediaAssetListItem = {
  id: UUID;
  org_id: OrgId;
  org_name: string | null;
  uploader_id: UserId;
  uploader_name: string | null;
  uploader_username: string | null;
  status: MediaAssetStatus;
  processing_stage: string | null;
  kind: MediaAssetKind;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  duration_seconds: number;
  storage_path: string;
  bucket: string;
  streaming_ready: boolean;
  thumbnail_path: string | null;
  transcode_progress: number | null;
  created_at: Date;
};

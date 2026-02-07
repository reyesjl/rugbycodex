import type { UUID } from '@/modules/orgs/types/UUID';
import type { OrgId } from '@/modules/orgs/types/OrgId';
import type { UserId } from '@/modules/orgs/types/UserId';
import type { NarrationSourceType } from './Narration';

/**
 * Admin list item for narrations with aggregated details
 */
export type AdminNarrationListItem = {
  id: UUID;
  org_id: OrgId;
  org_name: string | null;
  media_asset_id: UUID;
  media_asset_title: string | null;
  media_asset_segment_id: UUID;
  author_id: UserId | null;
  author_name: string | null;
  author_username: string | null;
  source_type: NarrationSourceType;
  transcript_raw: string;
  transcript_clean: string | null;
  transcript_lang: string | null;
  audio_storage_path: string | null;
  created_at: Date;
  updated_at: Date;
};

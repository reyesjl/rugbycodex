import type { UUID } from "@/modules/orgs/types/UUID";
import type { OrgId } from "@/modules/orgs/types/OrgId";
import type { UserId } from "@/modules/orgs/types/UserId";

export type NarrationSourceType = 'coach' | 'staff' | 'member';

export type Narration = {
  id: UUID;
  org_id: OrgId;
  media_asset_id: UUID;
  media_asset_segment_id: UUID;
  author_id: UserId | null;
  /** Snapshot of who authored the narration at creation time. */
  source_type: NarrationSourceType;
  audio_storage_path: string | null;
  transcript_raw: string;
  transcript_clean: string | null;
  transcript_lang: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * Narration with author profile information (from RPC)
 */
export type NarrationWithAuthor = Narration & {
  author_name: string | null;
  author_username: string | null;
};

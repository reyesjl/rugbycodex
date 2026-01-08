import type { UUID } from "@/modules/orgs/types/UUID";
import type { OrgId } from "@/modules/orgs/types/OrgId";
import type { UserId } from "@/modules/orgs/types/UserId";

export type Narration = {
  id: UUID;
  org_id: OrgId;
  media_asset_id: UUID;
  media_asset_segment_id: UUID;
  author_id: UserId | null;
  audio_storage_path: string | null;
  transcript_raw: string;
  transcript_clean: string | null;
  transcript_lang: string | null;
  created_at: Date;
  updated_at: Date;
};

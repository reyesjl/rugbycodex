import type { UUID } from "@/modules/orgs/types/UUID";
import type { SegmentTag } from "@/modules/media/types/SegmentTag";

export type MediaAssetSegmentSourceType = 'owner' | 'manager' | 'coach' | 'staff' | 'member' | 'auto' | 'ai';

export type MediaAssetSegment = {
  id: UUID;
  media_asset_id: UUID;
  segment_index: number;
  start_seconds: number;
  end_seconds: number;
  created_at: Date;

  /** Optional fields (not required by existing callers). */
  source_type?: MediaAssetSegmentSourceType | null;
  created_by_profile_id?: UUID | null;
  tags?: SegmentTag[];
};

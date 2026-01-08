import type { UUID } from "@/modules/orgs/types/UUID";

export type MediaAssetSegment = {
  id: UUID;
  media_asset_id: UUID;
  segment_index: number;
  start_seconds: number;
  end_seconds: number;
  created_at: Date;
};

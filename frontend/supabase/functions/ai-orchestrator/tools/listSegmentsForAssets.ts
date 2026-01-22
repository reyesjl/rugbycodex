import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type SegmentRow = {
  id: string;
  media_asset_id: string;
  segment_index: number | null;
  start_seconds: number | null;
  end_seconds: number | null;
};

export async function listSegmentsForAssets(supabase: SupabaseClient, assetIds: string[]) {
  if (!assetIds.length) return [] as SegmentRow[];

  const { data, error } = await supabase
    .from("media_asset_segments")
    .select("id, media_asset_id, segment_index, start_seconds, end_seconds")
    .in("media_asset_id", assetIds)
    .order("segment_index", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SegmentRow[];
}

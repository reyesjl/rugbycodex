import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type NarrationRow = {
  id: string;
  media_asset_segment_id: string | null;
  transcript_raw: string | null;
  transcript_clean: string | null;
  created_at: string | null;
};

export async function listNarrationsForSegments(supabase: SupabaseClient, segmentIds: string[]) {
  if (!segmentIds.length) return [] as NarrationRow[];

  const { data, error } = await supabase
    .from("narrations")
    .select("id, media_asset_segment_id, transcript_raw, transcript_clean, created_at")
    .in("media_asset_segment_id", segmentIds)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as NarrationRow[];
}

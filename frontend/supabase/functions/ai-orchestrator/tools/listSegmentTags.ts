import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type SegmentTagRow = {
  segment_id: string;
  tag_key: string;
  tag_type: string | null;
};

export async function listSegmentTags(supabase: SupabaseClient, segmentIds: string[]) {
  if (!segmentIds.length) return [] as SegmentTagRow[];

  const { data, error } = await supabase
    .from("segment_tags")
    .select("segment_id, tag_key, tag_type")
    .in("segment_id", segmentIds);

  if (error) throw error;
  return (data ?? []) as SegmentTagRow[];
}

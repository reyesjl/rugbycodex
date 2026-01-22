import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function attachSegmentToAssignment(
  supabase: SupabaseClient,
  assignmentId: string,
  segmentId: string
) {
  const { error } = await supabase
    .from("assignment_segments")
    .insert({ assignment_id: assignmentId, media_segment_id: segmentId });

  if (error) throw error;
}

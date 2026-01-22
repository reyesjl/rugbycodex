import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type AssignmentRow = {
  id: string;
  org_id: string;
  title: string | null;
  description: string | null;
};

export type AssignmentSegmentRow = {
  assignment_id: string;
  media_segment_id: string | null;
};

export type AssignmentTargetRow = {
  assignment_id: string;
  target_type: string | null;
  target_id: string | null;
};

export async function listAssignmentsForOrg(supabase: SupabaseClient, orgId: string) {
  const { data: assignments, error } = await supabase
    .from("assignments")
    .select("id, org_id, title, description")
    .eq("org_id", orgId);

  if (error) throw error;

  const assignmentIds = (assignments ?? []).map((row) => row.id).filter(Boolean);
  if (!assignmentIds.length) {
    return {
      assignments: (assignments ?? []) as AssignmentRow[],
      segments: [] as AssignmentSegmentRow[],
      targets: [] as AssignmentTargetRow[],
    };
  }

  const { data: segments, error: segError } = await supabase
    .from("assignment_segments")
    .select("assignment_id, media_segment_id")
    .in("assignment_id", assignmentIds);

  if (segError) throw segError;

  const { data: targets, error: targetError } = await supabase
    .from("assignment_targets")
    .select("assignment_id, target_type, target_id")
    .in("assignment_id", assignmentIds);

  if (targetError) throw targetError;

  return {
    assignments: (assignments ?? []) as AssignmentRow[],
    segments: (segments ?? []) as AssignmentSegmentRow[],
    targets: (targets ?? []) as AssignmentTargetRow[],
  };
}

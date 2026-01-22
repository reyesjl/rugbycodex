import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { AssignmentRow, AssignmentSegmentRow, AssignmentTargetRow } from "./listAssignmentsForOrg.ts";

export async function listAssignmentsForProfile(
  supabase: SupabaseClient,
  orgId: string,
  profileId: string,
  groupIds: string[]
) {
  const hasGroups = groupIds.length > 0;
  const groupIdList = groupIds.map((id) => `"${id}"`).join(",");

  let targetsQuery = supabase
    .from("assignment_targets")
    .select("assignment_id, target_type, target_id")
    .eq("target_type", "profile")
    .eq("target_id", profileId);

  if (hasGroups) {
    targetsQuery = supabase
      .from("assignment_targets")
      .select("assignment_id, target_type, target_id")
      .or(
        `and(target_type.eq.profile,target_id.eq.${profileId}),and(target_type.eq.group,target_id.in.(${groupIdList}))`
      );
  }

  const { data: targets, error: targetError } = await targetsQuery;
  if (targetError) throw targetError;

  const assignmentIds = (targets ?? []).map((row) => row.assignment_id).filter(Boolean);
  if (!assignmentIds.length) {
    return {
      assignments: [] as AssignmentRow[],
      segments: [] as AssignmentSegmentRow[],
      targets: (targets ?? []) as AssignmentTargetRow[],
    };
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select("id, org_id, title, description")
    .eq("org_id", orgId)
    .in("id", assignmentIds);

  if (assignmentsError) throw assignmentsError;

  const { data: segments, error: segError } = await supabase
    .from("assignment_segments")
    .select("assignment_id, media_segment_id")
    .in("assignment_id", assignmentIds);

  if (segError) throw segError;

  return {
    assignments: (assignments ?? []) as AssignmentRow[],
    segments: (segments ?? []) as AssignmentSegmentRow[],
    targets: (targets ?? []) as AssignmentTargetRow[],
  };
}

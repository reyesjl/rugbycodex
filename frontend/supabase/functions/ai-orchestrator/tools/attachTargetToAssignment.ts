import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function attachTargetToAssignment(
  supabase: SupabaseClient,
  assignmentId: string,
  targetType: "group" | "profile",
  targetId: string
) {
  const { error } = await supabase
    .from("assignment_targets")
    .insert({ assignment_id: assignmentId, target_type: targetType, target_id: targetId });

  if (error) throw error;
}

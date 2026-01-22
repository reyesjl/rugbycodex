import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type GroupMembershipRow = {
  id: string;
  group_id: string;
  profile_id: string;
};

export async function listGroupMemberships(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("id, group_id, profile_id")
    .eq("profile_id", profileId);

  if (error) throw error;
  return (data ?? []) as GroupMembershipRow[];
}

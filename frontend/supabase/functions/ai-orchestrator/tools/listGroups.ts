import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type GroupRow = {
  id: string;
  org_id: string;
  name: string | null;
};

export async function listGroups(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from("groups")
    .select("id, org_id, name")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as GroupRow[];
}

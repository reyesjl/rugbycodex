import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type MatchAssetRow = {
  id: string;
  org_id: string;
  file_name: string | null;
  duration_seconds: number | null;
  created_at: string | null;
  kind?: string | null;
};

export async function listMatchAssets(supabase: SupabaseClient, orgId: string, limit = 2) {
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, org_id, file_name, duration_seconds, created_at, kind")
    .eq("org_id", orgId)
    .eq("kind", "match")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as MatchAssetRow[];
}

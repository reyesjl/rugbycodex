import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function createAssignment(
  supabase: SupabaseClient,
  payload: {
    org_id: string;
    created_by: string;
    title: string;
    description?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      org_id: payload.org_id,
      created_by: payload.created_by,
      title: payload.title,
      description: payload.description ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data?.id as string;
}

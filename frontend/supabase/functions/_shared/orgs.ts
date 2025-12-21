import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * @param orgId 
 * @param userId 
 * @param supabase The existing Supabase client instance
 * @returns True if the user is a member of the organization, false otherwise
 */
export async function isOrgMember(orgId: string, userId: string, supabase: SupabaseClient): bool {
  const { data, error } = await supabase
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error checking org membership:', error);
    return false;
  }

  return data !== null;
}

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { logEvent } from './observability.ts';

/**
 * @param orgId 
 * @param userId 
 * @param supabase The existing Supabase client instance
 * @returns True if the user is a member of the organization, false otherwise
 */
export async function isOrgMember(
  orgId: string,
  userId: string,
  supabase: SupabaseClient,
  requestId?: string,
): boolean {
  const { data, error } = await supabase
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single();

  if (error) {
    logEvent({
      severity: 'error',
      event_type: 'org_membership_check_failed',
      request_id: requestId,
      org_id: orgId,
      user_id: userId,
      error_code: 'SUPABASE_READ_FAILED',
      error_message: error.message,
    });
    return false;
  }

  return data !== null;
}

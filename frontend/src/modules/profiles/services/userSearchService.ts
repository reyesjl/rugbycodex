import { supabase } from '@/lib/supabaseClient';

/**
 * Searchable user profile for org invitations
 */
export type SearchableUser = {
  id: string;
  username: string;
  name: string;
};

/**
 * Service for searching users to add to organizations
 */
export const userSearchService = {
  /**
   * Search users by name or username for org invitation
   * Excludes users already in the organization
   * 
   * @param orgId - Organization ID to filter existing members
   * @param query - Search query (name or username). Empty = recent users
   * @param limit - Maximum results to return (default 20)
   * @returns Array of searchable users
   */
  async searchUsersForOrg(
    orgId: string,
    query: string,
    limit = 20
  ): Promise<SearchableUser[]> {
    const { data, error } = await supabase.rpc('search_users_for_org_invite', {
      p_org_id: orgId,
      p_search_query: query.trim(),
      p_limit: limit,
    });

    if (error) {
      console.error('User search error:', error);
      throw new Error(`Failed to search users: ${error.message}`);
    }

    return (data || []) as SearchableUser[];
  },
};

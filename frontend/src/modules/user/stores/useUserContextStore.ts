import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { supabase } from '@/lib/supabaseClient';
import type { Profile } from '@/modules/profiles/types/Profile';
import type { UserOrganizationSummary } from '@/modules/orgs/types';

/**
 * User context returned from the get_user_context() RPC function
 */
export type UserContext = {
  profile: Profile | null;
  organizations: UserOrganizationSummary[];
  primary_org: any | null; // Organization type
};

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Unified store for user profile + organization memberships.
 * Replaces the combination of useProfileStore + useMyOrganizationsStore.
 * 
 * Loads all user context in a single optimized RPC call instead of 3+ sequential queries.
 */
export const useUserContextStore = defineStore('userContext', () => {
  // =========================================================================
  // State
  // =========================================================================
  
  const profile = ref<Profile | null>(null);
  const organizations = ref<UserOrganizationSummary[]>([]);
  const primaryOrg = ref<any | null>(null);
  
  const status = ref<LoadStatus>('idle');
  const error = ref<string | null>(null);
  
  let loadToken = 0;

  // =========================================================================
  // Computed
  // =========================================================================
  
  const isLoading = computed(() => status.value === 'loading');
  const isReady = computed(() => status.value === 'ready');
  const hasError = computed(() => status.value === 'error');
  const isIdle = computed(() => status.value === 'idle');
  
  const hasProfile = computed(() => !!profile.value);
  const hasOrganizations = computed(() => organizations.value.length > 0);
  const organizationCount = computed(() => organizations.value.length);
  
  const isAdmin = computed(() => profile.value?.role === 'admin');
  
  const fallbackOrg = computed(() => organizations.value[0] ?? null);

  // Readonly exports
  const profileReadonly = computed(() => profile.value);
  const organizationsReadonly = computed(() => organizations.value);
  const primaryOrgReadonly = computed(() => primaryOrg.value);
  const statusReadonly = computed(() => status.value);
  const errorReadonly = computed(() => error.value);

  // =========================================================================
  // Actions
  // =========================================================================
  
  /**
   * Load user context from the database using the optimized RPC function.
   * This replaces separate calls to load profile and organizations.
   * 
   * @param opts.force - Force reload even if already loaded
   */
  async function load(opts?: { force?: boolean }): Promise<void> {
    const force = opts?.force ?? false;
    
    // Skip if already loaded and not forcing
    if (status.value === 'ready' && !force) {
      return;
    }
    
    const token = ++loadToken;
    
    status.value = 'loading';
    error.value = null;
    
    try {
      // Call the unified RPC function
      const { data, error: rpcError } = await supabase.rpc('get_user_context');
      
      if (rpcError) throw rpcError;
      
      // Check if this request is still valid (not cancelled by a newer request)
      if (token !== loadToken) return;
      
      // Parse the response
      const context = data as UserContext;
      
      if (!context) {
        throw new Error('No context returned from server');
      }
      
      // Update state
      profile.value = context.profile;
      organizations.value = context.organizations ?? [];
      primaryOrg.value = context.primary_org;
      
      status.value = 'ready';
      
      console.log('[UserContext] Loaded successfully', {
        hasProfile: !!context.profile,
        orgCount: organizations.value.length,
        hasPrimaryOrg: !!context.primary_org,
      });
      
    } catch (err) {
      // Check if this request is still valid
      if (token !== loadToken) return;
      
      status.value = 'error';
      error.value = err instanceof Error ? err.message : 'Failed to load user context';
      
      // Clear state on error
      profile.value = null;
      organizations.value = [];
      primaryOrg.value = null;
      
      console.error('[UserContext] Load failed:', error.value);
    }
  }
  
  /**
   * Force reload the user context.
   * Useful after creating a new organization or updating profile.
   */
  async function reload(): Promise<void> {
    return load({ force: true });
  }
  
  /**
   * Clear all user context.
   * Should be called on logout.
   */
  function clear(): void {
    loadToken++;
    
    profile.value = null;
    organizations.value = [];
    primaryOrg.value = null;
    
    status.value = 'idle';
    error.value = null;
    
    console.log('[UserContext] Cleared');
  }
  
  /**
   * Update the profile name locally.
   * Useful for optimistic updates.
   */
  function updateProfileName(name: string): void {
    if (profile.value) {
      profile.value.name = name;
    }
  }
  
  /**
   * Update the profile username locally.
   * Useful for optimistic updates.
   */
  function updateProfileUsername(username: string): void {
    if (profile.value) {
      profile.value.username = username;
    }
  }

  // =========================================================================
  // Return
  // =========================================================================
  
  return {
    // State
    profile,
    organizations,
    primaryOrg,
    status,
    error,
    
    // Computed
    isLoading,
    isReady,
    hasError,
    isIdle,
    hasProfile,
    hasOrganizations,
    organizationCount,
    isAdmin,
    fallbackOrg,
    
    // Readonly
    profileReadonly,
    organizationsReadonly,
    primaryOrgReadonly,
    statusReadonly,
    errorReadonly,
    
    // Actions
    load,
    reload,
    clear,
    updateProfileName,
    updateProfileUsername,
  };
});

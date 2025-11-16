import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/stores/auth';

export type ProfileRole = 'admin' | 'moderator' | 'user';

export interface UserProfile {
  id: string;
  xp: number | null;
  creation_time: string | null;
  name: string;
  role: ProfileRole;
}

export interface OrgMembership {
  org_id: string;
  role: string;
  org_name: string;
  slug: string;
  join_date: Date;
}

export const useProfileStore = defineStore('profile', () => {
  const profile = ref<UserProfile | null>(null);
  const loadingProfile = ref(false);
  const lastError = ref<string | null>(null);

  const authStore = useAuthStore();

  const organizations = ref<OrgMembership[]>([]);
  const loadingOrganizations = ref(false);

  const fetchOrganizations = async () => {
    if (!authStore.user?.id) return;
    loadingOrganizations.value = true;
    organizations.value = [];

    try {
      const { data, error: fetchError } = await supabase
        .from('org_members')
        .select(`
          org_id,
          role,
          organizations (
            id,
            name,
            slug
          ),
          joined_at
        `)
        .eq('user_id', authStore.user.id);

      if (fetchError) {
        loadingOrganizations.value = false;
        throw fetchError;
      }

      // Transform the data to your Organization interface
      organizations.value = data?.map(item => ({
        org_id: item.org_id,
        org_name: (item.organizations as any)?.name || 'Unknown',
        join_date: new Date(item.joined_at),
        slug: (item.organizations as any)?.slug || 'unknown',
        role: item.role,
      })) ?? [];

      loadingOrganizations.value = false;

    } catch (err) {
      console.error('Failed to fetch organizations:', err);
      loadingOrganizations.value = false;
    }
  };

  const fetchProfile = async (userId: string) => {
    // TODO: Interrupt ongoing fetch?
    if (profile.value?.id === userId) {
      return;
    }
    loadingProfile.value = true;
    lastError.value = null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      profile.value = data as UserProfile;
      if (!loadingOrganizations.value) {
        fetchOrganizations();
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch profile';
      lastError.value = message;
    } finally {
      loadingProfile.value = false;
    }
  };

  watch(() => authStore.user, (newUser) => {
    if (newUser !== null) {
      if (!loadingProfile.value) fetchProfile(newUser.id);
    } else {
      profile.value = null;
      lastError.value = null;
      loadingProfile.value = false;
      organizations.value = [];
      loadingOrganizations.value = false;
    }
  }, { immediate: true });

  return {
    profile,
    loadingProfile,
    lastError,
    loadingOrganizations,
    organizations,
  };
});

import { computed, ref, type ComputedRef } from 'vue';
import { type OrgMembership, type ProfileDetail } from '@/profiles/types';
import { profileService } from '@/profiles/services/ProfileService';


export function useProfileFullDetail() {
  const profile = ref<ProfileDetail | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const loadProfile = async (id: string) => {
    clearProfile();
    try {
      profile.value = await profileService.profiles.getWithMemberships(id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load profile.';
    } finally {
      loading.value = false;
    }
  };

  const memberships: ComputedRef<OrgMembership[]> = computed(() => {
    return profile.value?.memberships || [];
  });

  function canManageOrg(orgId: string): boolean {
    const membership = memberships.value.find(org => org.org_id === orgId);
    if (!membership) return false;
    return membership.org_role === 'owner' || membership.org_role === 'manager';
  };

  function clearProfile() {
    profile.value = null;
    loading.value = false;
    error.value = null;
  }


  return {
    profile,
    loading,
    error,
    memberships,

    loadProfile,
    canManageOrg,
    clearProfile,
  }
};


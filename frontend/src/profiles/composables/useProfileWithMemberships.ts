import { computed, ref } from 'vue';
import { type ProfileDetail } from '@/profiles/types';
import { profileService } from '@/profiles/services/ProfileService';


export function useProfileWithMemberships() {
  const profile = ref<ProfileDetail | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const loadProfile = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      profile.value = await profileService.profiles.getWithMemberships(id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load profile.';
    } finally {
      loading.value = false;
    }
  };

  const memberships = computed(() => {
    return profile.value?.memberships || [];
  });

  const membershipCount = computed(() => {
    return memberships.value.length;
  });

  return {
    profile,
    loading,
    error,
    memberships,
    membershipCount,

    loadProfile,
  }
};


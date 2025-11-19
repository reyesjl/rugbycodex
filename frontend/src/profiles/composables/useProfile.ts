import { ref } from 'vue';
import { type UserProfile } from '@/profiles/types';
import { profileService } from '@/profiles/services/ProfileService';


export function useProfile() {
  const profile = ref<UserProfile | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const loadProfile = async (id : string | null) => {
    if (!id) {
      error.value = 'Profile ID is required to load profile.';
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      profile.value = await profileService.profiles.getById(id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load profile.';
    } finally {
      loading.value = false;
    }
  };

  return {
    profile,
    loading,
    error,
    loadProfile,
  }
};

import { ref } from 'vue';
import { type UserProfile } from '@/profiles/types';
import { profileService } from '@/profiles/services/ProfileService';


export function useProfilesList() {
  const profiles = ref<UserProfile[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const loadProfiles = async () => {
    loading.value = true;
    error.value = null;
    try {
      profiles.value = await profileService.profiles.list();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load profiles.';
    } finally {
      loading.value = false;
    }
  };

  return {

    profiles,
    loading,
    error,

    loadProfiles,
  }
};
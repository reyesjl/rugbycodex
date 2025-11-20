import { defineStore } from 'pinia';
import { watch } from 'vue';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useProfileFullDetail } from '../composables/useProfileFullDetail';


export const useProfileStore = defineStore('profile', () => {
  const {
    profile,
    loading: loadingProfile,
    error: lastError,
    memberships,
    loadProfile,
    canManageOrg,
    clearProfile,
  } = useProfileFullDetail();

  const authStore = useAuthStore();

  const fetchProfile = async (userId: string) => {
    // TODO: Interrupt ongoing fetch?
    if (profile.value?.id === userId) {
      return;
    }
    await loadProfile(userId);
  };

  watch(() => authStore.user, (newUser) => {
    if (newUser !== null) {
      if (!loadingProfile.value) fetchProfile(newUser.id);
    } else {
      clearProfile();
    }
  }, { immediate: true });

  return {
    profile,
    loadingProfile,
    lastError,
    memberships,
    canManageOrg,
  };
});

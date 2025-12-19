import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { profileService } from '../services/profileServiceV2';
import type { Profile } from '../types/Profile';

export const useProfileStore = defineStore('profile', () => {
  const authStore = useAuthStore();

  const profile = ref<Profile | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  const isAdmin = computed(() => profile.value?.role === 'admin');

  const load = async (opts?: { force?: boolean }) => {
    const force = opts?.force ?? false;
    if (loaded.value && !force) return;

    loading.value = true;
    error.value = null;

    try {
      profile.value = await profileService.getMyProfile();
      loaded.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load profile.';
      profile.value = null;
      loaded.value = false;
    } finally {
      loading.value = false;
    }
  };

  const clear = () => {
    profile.value = null;
    loading.value = false;
    error.value = null;
    loaded.value = false;
  };

  // react to auth lifecycle
  watch(
    () => authStore.user,
    (user) => {
      if (user) {
        void load({ force: true });
      } else {
        clear();
      }
    },
    { immediate: true }
  );

  return {
    profile,
    loading,
    error,
    loaded,
    isAdmin,
    load,
    clear,
  };
});


import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { profileService } from '../services/profileServiceV2';
import type { Profile } from '../types/Profile';


let loadToken = 0;

export const useProfileStore = defineStore('profile', () => {
  const authStore = useAuthStore();

  const data = {
    profile: ref<Profile | null>(null),
    loaded: ref(false),
  };

  const status = {
    loading: ref(false),
    error: ref<string | null>(null),
  };

  const profile = computed({
    get: () => data.profile.value,
    set: (next) => {
      data.profile.value = next;
    },
  });

  const loaded = computed({
    get: () => data.loaded.value,
    set: (next) => {
      data.loaded.value = next;
    },
  });

  const loading = computed({
    get: () => status.loading.value,
    set: (next) => {
      status.loading.value = next;
    },
  });

  const error = computed({
    get: () => status.error.value,
    set: (next) => {
      status.error.value = next;
    },
  });

  const isAdmin = computed(() => data.profile.value?.role === 'admin');

  const load = async (opts?: { force?: boolean }) => {
    const force = opts?.force ?? false;
    if (data.loaded.value && !force) return;

    const token = ++loadToken;

    status.loading.value = true;
    status.error.value = null;

    try {
      const nextProfile = await profileService.getMyProfile();
      if (token !== loadToken) return;

      data.profile.value = nextProfile;
      data.loaded.value = true;
    } catch (err) {
      if (token !== loadToken) return;

      status.error.value = err instanceof Error ? err.message : 'Failed to load profile.';
      data.profile.value = null;
      data.loaded.value = false;
    } finally {
      if (token === loadToken) {
        status.loading.value = false;
      }
    }
  };

  const clear = () => {
    loadToken += 1;

    data.profile.value = null;
    data.loaded.value = false;
    status.loading.value = false;
    status.error.value = null;
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


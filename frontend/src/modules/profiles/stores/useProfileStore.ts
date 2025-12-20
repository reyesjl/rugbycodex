import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { profileService } from '../services/profileServiceV2';
import type { Profile } from '../types/Profile';
import type { OrgMembership } from '@/modules/profiles/types';

export const useProfileStore = defineStore('profile', () => {
  const authStore = useAuthStore();

  const profile = ref<Profile | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  const isAdmin = computed(() => profile.value?.role === 'admin');

  const memberships = ref<OrgMembership[]>([]);

  const load = async (opts?: { force?: boolean }) => {
    const force = opts?.force ?? false;
    if (loaded.value && !force) return;

    loading.value = true;
    error.value = null;

    try {
      profile.value = await profileService.getMyProfile();
      memberships.value = await profileService.getMyMemberships();
      loaded.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load profile.';
      profile.value = null;
      loaded.value = false;
      memberships.value = [];
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
    memberships,
    load,
    clear,
  };
});


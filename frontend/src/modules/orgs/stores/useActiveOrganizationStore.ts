import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UserOrganizationSummary } from '@/modules/orgs/types';

export const useActiveOrganizationStore = defineStore('activeOrganization', () => {
  const active = ref<UserOrganizationSummary | null>(null);

  const hasActiveOrg = computed(() => !!active.value);

  function setActive(org: UserOrganizationSummary) {
    active.value = org;
  }

  function clear() {
    active.value = null;
  }

  return {
    active,
    hasActiveOrg,
    setActive,
    clear,
  };
});
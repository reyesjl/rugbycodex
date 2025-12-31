import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { UserOrganizationSummary } from "@/modules/orgs/types";
import { orgService } from "@/modules/orgs/services/orgServiceV2";

export const useActiveOrganizationStore = defineStore("activeOrganization", () => {
  const active = ref<UserOrganizationSummary | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  const hasActiveOrg = computed(() => !!active.value);

  function setActive(org: UserOrganizationSummary) {
    active.value = org;
    loaded.value = true;
  }

  async function load(opts?: { force?: boolean }) {
    const force = opts?.force ?? false;
    if (loaded.value && !force) return;

    loading.value = true;
    error.value = null;

    try {
      const ctx = await orgService.getActiveOrg(); // UserOrganizationSummary | null
      active.value = ctx;
      loaded.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Unable to load active organization.";
      active.value = null;
      loaded.value = false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Selects an org for this session *and* persists it as profiles.primary_org.
   * Optimistic UI: sets active immediately, then persists.
   * On failure: re-hydrates from DB to avoid client/server mismatch.
   */
  async function selectAndPersist(org: UserOrganizationSummary) {
    const previous = active.value;

    // optimistic
    setActive(org);

    try {
      await orgService.setPrimaryOrg(org.organization.id);
    } catch (err) {
      // revert to server truth (or previous)
      await load({ force: true });
      // if load fails, at least restore the previous in-memory selection
      if (!active.value) active.value = previous;
      throw err;
    }
  }

  function clear() {
    active.value = null;
    error.value = null;
    loading.value = false;
    loaded.value = false;
  }

  const refresh = async () => load({ force: true });

  return {
    active,
    hasActiveOrg,
    loading,
    error,
    loaded,
    setActive,
    selectAndPersist,
    clear,
    load,
    refresh,
  };
});

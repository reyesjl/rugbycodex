import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { usageService } from '@/modules/usage/services/usageService';
import type { OrgUsage } from '@/modules/usage/types/Usage';

export function useOrgUsage() {
  const activeOrgStore = useActiveOrganizationStore();
  const { orgContext } = storeToRefs(activeOrgStore);

  const orgId = computed(() => orgContext.value?.organization.id ?? null);

  const loading = ref(false);
  const error = ref<string | null>(null);
  const usage = ref<OrgUsage | null>(null);

  let loadToken = 0;

  const isWarning = computed(() => (usage.value?.percent_used ?? 0) >= 80);
  const isCritical = computed(() => (usage.value?.percent_used ?? 0) >= 95);

  async function load() {
    if (!orgId.value) {
      usage.value = null;
      return;
    }

    const token = ++loadToken;
    loading.value = true;
    error.value = null;

    try {
      const data = await usageService.getOrgUsage(orgId.value);
      if (token !== loadToken) return;
      usage.value = data;
    } catch (err) {
      if (token !== loadToken) return;
      error.value = err instanceof Error ? err.message : 'Unable to load usage.';
      usage.value = null;
    } finally {
      if (token === loadToken) {
        loading.value = false;
      }
    }
  }

  const reload = () => {
    void load();
  };

  onMounted(() => {
    void load();
  });

  watch(orgId, (next, prev) => {
    if (next && next !== prev) {
      void load();
    }
    if (!next) {
      usage.value = null;
    }
  });

  return {
    orgId,
    loading,
    error,
    usage,
    isWarning,
    isCritical,
    reload,
  };
}

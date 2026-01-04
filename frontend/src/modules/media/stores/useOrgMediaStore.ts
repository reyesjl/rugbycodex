import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useActiveOrganizationStore } from "@/modules/orgs/stores/useActiveOrganizationStore";
import { mediaService } from "@/modules/media/services/mediaService";
import type { OrgMediaAsset } from "@/modules/media/types/OrgMediaAsset";

export type OrgMediaStatus = "idle" | "loading" | "ready" | "error";

export const useOrgMediaStore = defineStore("orgMedia", () => {
  const activeOrganizationStore = useActiveOrganizationStore();

  const assets = ref<OrgMediaAsset[]>([]);
  const status = ref<OrgMediaStatus>("idle");
  const error = ref<string | null>(null);
  const loadedOrgId = ref<string | null>(null);
  const isLoading = computed(() => status.value === "loading");
  const isReady = computed(() => status.value === "ready");

  const activeOrgId = computed(() => activeOrganizationStore.active?.organization?.id ?? null);

  async function loadForActiveOrg() {
    const orgId = activeOrgId.value;
    if (!orgId) return;

    if (loadedOrgId.value === orgId) return;

    status.value = "loading";
    error.value = null;

    try {
      const results = await mediaService.listByOrganization(orgId);
      assets.value = results;
      loadedOrgId.value = orgId;
      status.value = "ready";
    } catch (err) {
      assets.value = [];
      loadedOrgId.value = null;
      status.value = "error";
      error.value = err instanceof Error ? err.message : "Failed to load media assets.";
    }
  }

  function reset() {
    assets.value = [];
    status.value = "idle";
    error.value = null;
    loadedOrgId.value = null;
  }

  watch(activeOrgId, (nextId, prevId) => {
    if (nextId !== prevId) {
      reset();
    }
  });

  return {
    assets,
    status,
    error,
    loadedOrgId,
    loadForActiveOrg,
    reset,
    isLoading,
    isReady,
  };
});

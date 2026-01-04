import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { useActiveOrganizationStore } from "@/modules/orgs/stores/useActiveOrganizationStore";
import { mediaService } from "@/modules/media/services/mediaService";
import type { OrgMediaAsset } from "@/modules/media/types/OrgMediaAsset";

export type OrgMediaStatus = "idle" | "loading" | "ready" | "error";

export type MediaContextState = "no_context" | "in_progress" | "contextualized";

export const useOrgMediaStore = defineStore("orgMedia", () => {
  const activeOrganizationStore = useActiveOrganizationStore();

  const assets = ref<OrgMediaAsset[]>([]);
  const narrationCounts = ref<Record<string, number>>({});
  const status = ref<OrgMediaStatus>("idle");
  const error = ref<string | null>(null);
  const loadedOrgId = ref<string | null>(null);
  const isLoading = computed(() => status.value === "loading");
  const isReady = computed(() => status.value === "ready");

  const activeOrgId = computed(() => activeOrganizationStore.active?.organization?.id ?? null);

  function narrationCountByAssetId(assetId: string): number {
    return narrationCounts.value[assetId] ?? 0;
  }

  function hasNarrations(assetId: string): boolean {
    return narrationCountByAssetId(assetId) > 0;
  }

  /**
   * Semantic state only (no UI):
   * - no_context: 0 narrations
   * - in_progress: 1–10 narrations (context exists but is still sparse)
   * - contextualized: 10+ narrations (soft target for "context coverage")
   */
  function getContextState(assetId: string): MediaContextState {
    const count = narrationCountByAssetId(assetId);
    if (count <= 0) return "no_context";
    if (count < 10) return "in_progress";
    return "contextualized";
  }

  async function loadForActiveOrg() {
    const orgId = activeOrgId.value;
    if (!orgId) return;

    if (loadedOrgId.value === orgId) return;

    status.value = "loading";
    error.value = null;

    try {
      const [assetsResult, narrationCountRows] = await Promise.all([
        mediaService.listByOrganization(orgId),
        mediaService.getNarrationCountsByOrg(orgId),
      ]);

      assets.value = assetsResult;

      narrationCounts.value = narrationCountRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.media_asset_id] = row.count;
        return acc;
      }, {});

      loadedOrgId.value = orgId;
      status.value = "ready";
    } catch (err) {
      assets.value = [];
      narrationCounts.value = {};
      loadedOrgId.value = null;
      status.value = "error";
      error.value = err instanceof Error ? err.message : "Failed to load media assets.";
    }
  }

  function reset() {
    assets.value = [];
    narrationCounts.value = {};
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
    narrationCounts,
    status,
    error,
    loadedOrgId,
    loadForActiveOrg,
    reset,
    isLoading,
    isReady,
    narrationCountByAssetId,
    hasNarrations,
    getContextState,
  };
});

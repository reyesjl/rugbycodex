import { defineStore } from "pinia";
import { computed, reactive, toRef, watch } from "vue";
import { useActiveOrganizationStore } from "@/modules/orgs/stores/useActiveOrganizationStore";
import { mediaService } from "@/modules/media/services/mediaService";
import type { OrgMediaAsset } from "@/modules/media/types/OrgMediaAsset";

export type OrgMediaStatus = "idle" | "loading" | "ready" | "error";

export type MediaContextState = "no_context" | "in_progress" | "contextualized";

let loadToken = 0;

export const useOrgMediaStore = defineStore("orgMedia", () => {
  const activeOrganizationStore = useActiveOrganizationStore();

  const data = reactive({
    assets: [] as OrgMediaAsset[],
    narrationCounts: {} as Record<string, number>,
    loadedOrgId: null as string | null,
  });

  const status = reactive({
    state: "idle" as OrgMediaStatus,
    error: null as string | null,
  });

  const assets = toRef(data, "assets");
  const narrationCounts = toRef(data, "narrationCounts");
  const loadedOrgId = toRef(data, "loadedOrgId");
  const error = toRef(status, "error");
  const isLoading = computed(() => status.state === "loading");
  const isReady = computed(() => status.state === "ready");
  const isIdle = computed(() => status.state === "idle");

  const activeOrgId = computed(() => activeOrganizationStore.orgContext?.organization?.id ?? null);

  function narrationCountByAssetId(assetId: string): number {
    return data.narrationCounts[assetId] ?? 0;
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

    if (data.loadedOrgId === orgId) return;

    loadToken += 1;
    const token = loadToken;

    status.state = "loading";
    status.error = null;

    try {
      const [assetsResult, narrationCountRows] = await Promise.all([
        mediaService.listByOrganization(orgId),
        mediaService.getNarrationCountsByOrg(orgId),
      ]);

       if (token !== loadToken) return;

      data.assets = assetsResult;

      data.narrationCounts = narrationCountRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.media_asset_id] = row.count;
        return acc;
      }, {});

      data.loadedOrgId = orgId;
      status.state = "ready";
    } catch (err) {
      if (token !== loadToken) return;

      data.assets = [];
      data.narrationCounts = {};
      data.loadedOrgId = null;
      status.state = "error";
      status.error = err instanceof Error ? err.message : "Failed to load media assets.";
    }
  }

  function reset() {
    loadToken += 1;
    data.assets = [];
    data.narrationCounts = {};
    data.loadedOrgId = null;
    status.state = "idle";
    status.error = null;
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
    isIdle,
    narrationCountByAssetId,
    hasNarrations,
    getContextState,
  };
});

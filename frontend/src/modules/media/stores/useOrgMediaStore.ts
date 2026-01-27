import { defineStore } from "pinia";
import { computed, onUnmounted, reactive, toRef, watch } from "vue";
import { useActiveOrganizationStore } from "@/modules/orgs/stores/useActiveOrganizationStore";
import { mediaService } from "@/modules/media/services/mediaService";
import { supabase } from "@/lib/supabaseClient";
import type { OrgMediaAsset } from "@/modules/media/types/OrgMediaAsset";

export type OrgMediaStatus = "idle" | "loading" | "ready" | "error";

export type MediaContextState = "no_context" | "in_progress" | "contextualized";

let loadToken = 0;
let pollingInterval: number | null = null;
let pollCount = 0;
let lastFullReload = 0;

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

  const processingAssets = computed(() =>
    data.assets.filter(a => 
      // Transcoding: status ready but not streaming_ready yet
      (a.status === 'ready' && !a.streaming_ready) ||
      // Event detection: actively detecting events
      (a.processing_stage === 'detecting_events')
    )
  );

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

  function getPollingDelay(): number {
    if (pollCount < 6) return 5000;
    if (pollCount < 12) return 10000;
    if (pollCount < 18) return 30000;
    return 60000;
  }

  async function pollProcessingAssets() {
    const orgId = activeOrgId.value;
    if (!orgId) {
      stopPolling();
      return;
    }

    const processingIds = processingAssets.value.map(a => a.id);
    if (processingIds.length === 0) {
      stopPolling();
      return;
    }

    const timeSinceReload = Date.now() - lastFullReload;
    if (timeSinceReload < 3000) {
      pollingInterval = window.setTimeout(pollProcessingAssets, getPollingDelay());
      return;
    }

    pollCount++;

    try {
      const { data: updated, error } = await supabase
        .from('media_assets')
        .select('id, status, streaming_ready')
        .eq('org_id', orgId)
        .in('id', processingIds);

      if (error) throw error;

      if (updated && updated.length > 0) {
        let completedCount = 0;
        
        updated.forEach((updatedAsset: any) => {
          const index = data.assets.findIndex(a => a.id === updatedAsset.id);
          if (index !== -1) {
            const existingAsset = data.assets[index];
            if (!existingAsset) return;

            const wasProcessing = !existingAsset.streaming_ready;

            existingAsset.streaming_ready = updatedAsset.streaming_ready;
            existingAsset.status = updatedAsset.status;
            
            if (wasProcessing && updatedAsset.streaming_ready) {
              completedCount++;
            }
          }
        });

        if (completedCount > 0) {
          console.log(`[OrgMedia] ✅ ${completedCount} video(s) finished processing and ready to watch!`);
        }
      }

      if (processingAssets.value.length > 0) {
        pollingInterval = window.setTimeout(pollProcessingAssets, getPollingDelay());
      } else {
        console.log('[OrgMedia] All videos processed, stopping poll');
        stopPolling();
      }
    } catch (err) {
      console.error('[OrgMedia] Polling error:', err);
      pollingInterval = window.setTimeout(pollProcessingAssets, getPollingDelay());
    }
  }

  function startPolling() {
    if (pollingInterval) return;
    
    console.log('[OrgMedia] 🔄 Starting polling for processing videos');
    pollCount = 0;
    pollingInterval = window.setTimeout(pollProcessingAssets, getPollingDelay());
  }

  function stopPolling() {
    if (pollingInterval) {
      clearTimeout(pollingInterval);
      pollingInterval = null;
      pollCount = 0;
    }
  }

  async function loadForActiveOrg() {
    const orgId = activeOrgId.value;
    if (!orgId) return;

    if (data.loadedOrgId === orgId) return;

    await forceReload();
  }

  async function forceReload() {
    const orgId = activeOrgId.value;
    if (!orgId) return;

    loadToken += 1;
    const token = loadToken;
    lastFullReload = Date.now();

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
      
      // Check if polling should start after reload
      if (processingAssets.value.length > 0 && !pollingInterval) {
        console.log('[OrgMedia] 🔄 Auto-starting polling after reload');
        startPolling();
      }
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
    stopPolling();
    data.assets = [];
    data.narrationCounts = {};
    data.loadedOrgId = null;
    status.state = "idle";
    status.error = null;
  }

  watch(processingAssets, (assets) => {
    if (assets.length > 0 && !pollingInterval) {
      startPolling();
    }
  }, { immediate: true });

  watch(activeOrgId, (nextId, prevId) => {
    if (nextId !== prevId) {
      reset();
    }
  });

  onUnmounted(() => {
    stopPolling();
  });

  return {
    assets,
    narrationCounts,
    status,
    error,
    loadedOrgId,
    loadForActiveOrg,
    forceReload,
    reset,
    isLoading,
    isReady,
    isIdle,
    narrationCountByAssetId,
    hasNarrations,
    getContextState,
  };
});

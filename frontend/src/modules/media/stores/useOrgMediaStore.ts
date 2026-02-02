import { defineStore } from "pinia";
import { computed, reactive, toRef, watch } from "vue";
import { useActiveOrganizationStore } from "@/modules/orgs/stores/useActiveOrganizationStore";
import { mediaService } from "@/modules/media/services/mediaService";
import { useMediaRealtime } from "@/modules/media/composables/useMediaRealtime";
import type { OrgMediaAsset } from "@/modules/media/types/OrgMediaAsset";

export type OrgMediaStatus = "idle" | "loading" | "ready" | "error";

export type MediaContextState = "no_context" | "in_progress" | "contextualized";

let loadToken = 0;

export const useOrgMediaStore = defineStore("orgMedia", () => {
  const activeOrganizationStore = useActiveOrganizationStore();
  const { subscribe, unsubscribe, isSubscribed } = useMediaRealtime();

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

  /**
   * Handle realtime updates from Supabase.
   * Updates assets in place when processing status changes.
   */
  function handleRealtimeUpdate(payload: any) {
    const updatedAsset = payload.new;
    if (!updatedAsset) return;

    const index = data.assets.findIndex(a => a.id === updatedAsset.id);

    if (payload.eventType === 'INSERT') {
      // New asset uploaded (might be from another tab or user)
      if (index === -1) {
        console.log('[OrgMedia] 📥 Adding new asset from realtime:', updatedAsset.id);
        data.assets.unshift(updatedAsset);
      }
    } else if (payload.eventType === 'UPDATE') {
      if (index !== -1) {
        const existingAsset = data.assets[index];
        if (!existingAsset) return;

        const wasProcessing = !existingAsset.streaming_ready;

        // Replace entire asset object to get full reactivity for all fields
        // This makes title, file_name, thumbnail_path, etc. all reactive
        Object.assign(existingAsset, updatedAsset);
        
        // Log when video finishes processing  
        if (wasProcessing && updatedAsset.streaming_ready) {
          console.log(`[OrgMedia] ✅ Video ready to watch:`, existingAsset.id);
        }

        // Log processing stage changes
        if (updatedAsset.processing_stage && updatedAsset.processing_stage !== existingAsset.processing_stage) {
          console.log(`[OrgMedia] 🔄 Processing stage: ${updatedAsset.processing_stage}`);
        }

        // Log transcode progress updates
        if (updatedAsset.transcode_progress !== undefined && updatedAsset.transcode_progress !== existingAsset.transcode_progress) {
          console.log(`[OrgMedia] 📊 Transcode progress: ${updatedAsset.transcode_progress}%`);
        }
      }
    }
  }

  /**
   * Subscribe to realtime updates for the active organization.
   */
  function subscribeToChanges() {
    const orgId = activeOrgId.value;
    if (!orgId) {
      console.warn('[OrgMedia] Cannot subscribe: no active org');
      return;
    }

    // Don't subscribe if already subscribed
    if (isSubscribed.value) {
      console.log('[OrgMedia] Already subscribed to realtime');
      return;
    }

    subscribe(orgId, handleRealtimeUpdate);
  }

  /**
   * Unsubscribe from realtime updates.
   */
  function unsubscribeFromChanges() {
    if (isSubscribed.value) {
      unsubscribe();
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
      
      // Subscribe to realtime updates after initial load
      subscribeToChanges();
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
    unsubscribeFromChanges();
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
    forceReload,
    reset,
    isLoading,
    isReady,
    isIdle,
    narrationCountByAssetId,
    hasNarrations,
    getContextState,
    subscribeToChanges,
    unsubscribeFromChanges,
    isSubscribed,
  };
});

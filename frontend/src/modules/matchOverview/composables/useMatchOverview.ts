import { ref, watch } from 'vue';
import { matchOverviewService } from '@/modules/matchOverview/services/matchOverviewService';
import type { MatchOverviewDTO } from '@/modules/matchOverview/types/MatchOverview';

type MatchOverviewOptions = {
  orgId: () => string | null;
  mediaAssetId: () => string;
  trendWindow?: () => number;
  feedLimit?: () => number;
};

export function useMatchOverview(options: MatchOverviewOptions) {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const overview = ref<MatchOverviewDTO | null>(null);
  let requestId = 0;

  async function reload(params?: { forceRefresh?: boolean }) {
    const activeRequestId = ++requestId;
    const orgId = options.orgId();
    const mediaAssetId = options.mediaAssetId();
    if (!orgId || !mediaAssetId) return;

    loading.value = true;
    error.value = null;

    try {
      const data = await matchOverviewService.getOverview(orgId, mediaAssetId, {
        trendWindow: options.trendWindow ? options.trendWindow() : 3,
        feedLimit: options.feedLimit ? options.feedLimit() : 20,
        forceRefresh: Boolean(params?.forceRefresh),
      });
      if (activeRequestId !== requestId) return;
      overview.value = data;
    } catch (err) {
      if (activeRequestId !== requestId) return;
      error.value = err instanceof Error ? err.message : 'Unable to load match overview.';
      overview.value = null;
    } finally {
      if (activeRequestId === requestId) {
        loading.value = false;
      }
    }
  }

  watch(
    [() => options.orgId(), () => options.mediaAssetId()],
    () => {
      void reload();
    },
    { immediate: true }
  );

  return {
    loading,
    error,
    overview,
    reload,
  };
}

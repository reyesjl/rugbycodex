import { computed, ref, watch } from 'vue';
import { mediaService } from '@/modules/media/services/mediaService';
import type { FeedItem } from '@/modules/feed/types/FeedItem';

/**
 * Preloads/retains signed HLS playlist object URLs for adjacent feed items.
 *
 * Extension point:
 * - Swap object-URL strategy to presigned URL strategy if desired.
 */
export function useFeedPreload(options: {
  items: () => FeedItem[];
  activeIndex: () => number;
  radius?: number;
}) {
  const radius = options.radius ?? 1;

  // cache by media_asset_id (one playlist per asset)
  const srcByMediaAssetId = ref<Record<string, string>>({});
  const errorsByMediaAssetId = ref<Record<string, string>>({});

  const items = computed(() => options.items());

  async function ensureSrcForItem(item: FeedItem): Promise<string | null> {
    const mediaAssetId = item.mediaAssetId;
    if (!mediaAssetId) return null;
    const cached = srcByMediaAssetId.value[mediaAssetId];
    if (cached) return cached;

    try {
      // IMPORTANT: this mirrors the working OrgMediaAssetView/MediaAssetSegmentView playback path.
      const url = await mediaService.getPresignedHlsPlaylistUrl(item.orgId, mediaAssetId, item.bucket);
      srcByMediaAssetId.value = { ...srcByMediaAssetId.value, [mediaAssetId]: url };
      return url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load this clip.';
      errorsByMediaAssetId.value = { ...errorsByMediaAssetId.value, [mediaAssetId]: message };
      return null;
    }
  }

  function getSrc(mediaAssetId: string): string {
    return srcByMediaAssetId.value[mediaAssetId] ?? '';
  }

  function getError(mediaAssetId: string): string | null {
    return errorsByMediaAssetId.value[mediaAssetId] ?? null;
  }

  watch(
    () => [options.activeIndex(), items.value.map((i) => i.mediaAssetId).join('|')],
    () => {
      const current = options.activeIndex();
      const list = items.value;
      const indices: number[] = [];
      for (let d = -radius; d <= radius; d += 1) {
        const idx = current + d;
        if (idx >= 0 && idx < list.length) indices.push(idx);
      }

      // Fire-and-forget preload for the window.
      void Promise.all(indices.map((i) => ensureSrcForItem(list[i]!)));
    },
    { immediate: true }
  );

  return {
    ensureSrcForItem,
    getSrc,
    getError,
  };
}

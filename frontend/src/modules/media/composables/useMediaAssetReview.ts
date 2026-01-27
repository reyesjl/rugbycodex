import { computed, ref, watch } from 'vue';
import { analysisService } from '@/modules/analysis/services/analysisService';
import type { MatchSummary } from '@/modules/analysis/types/MatchSummary';
import type { NarrationListItem } from '@/modules/narrations/composables/useNarrationRecorder';
import { narrationService } from '@/modules/narrations/services/narrationService';
import type { Narration } from '@/modules/narrations/types/Narration';
import { mediaService } from '@/modules/media/services/mediaService';
import { segmentService } from '@/modules/media/services/segmentService';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';
import type { SegmentTag, SegmentTagType } from '@/modules/media/types/SegmentTag';
import { useSegmentTags } from '@/modules/media/composables/useSegmentTags';

type MediaAssetReviewOptions = {
  orgId: () => string | null;
  mediaAssetId: () => string;
  canGenerateMatchSummary?: () => boolean;
};

export function useMediaAssetReview(options: MediaAssetReviewOptions) {
  const loading = ref(true);
  const error = ref<string | null>(null);
  const asset = ref<OrgMediaAsset | null>(null);
  const playlistUrl = ref<string>('');
  const segments = ref<MediaAssetSegment[]>([]);
  const narrations = ref<Array<Narration | NarrationListItem>>([]);
  const matchSummary = ref<MatchSummary | null>(null);
  const matchSummaryLoading = ref(false);
  const matchSummaryError = ref<string | null>(null);
  let requestId = 0;
  let matchSummaryRequestId = 0;

  const MIN_NARRATIONS_FOR_SUMMARY = 5;

  function getMatchSummaryStateFromCount(count: number): MatchSummary['state'] {
    if (count <= 0) return 'empty';
    if (count < MIN_NARRATIONS_FOR_SUMMARY) return 'light';
    return 'normal';
  }

  const segmentIds = computed(() => segments.value.map((seg) => String(seg.id)).filter(Boolean));
  const segmentTags = useSegmentTags({ segmentIds: () => segmentIds.value });

  // Moved from OrgMediaAssetReviewView.hydrateSegmentTags.
  function applyTagsToSegments(tagsBySegmentId: Record<string, SegmentTag[]>): void {
    if (Object.keys(tagsBySegmentId).length === 0) return;

    segments.value = segments.value.map((seg) => {
      const segmentId = String(seg.id);
      if (!(segmentId in tagsBySegmentId)) return seg;
      return { ...seg, tags: tagsBySegmentId[segmentId] ?? [] };
    });
  }

  watch(
    () => segmentTags.tagsBySegmentId.value,
    (next) => {
      applyTagsToSegments(next);
    },
    { deep: true }
  );

  function addSegmentTag(payload: { segmentId: string; tagKey: string; tagType: SegmentTagType }) {
    return segmentTags.addTag(payload);
  }

  function removeSegmentTag(payload: { segmentId: string; tagId: string }) {
    return segmentTags.removeTag(payload);
  }

  // Moved from OrgMediaAssetReviewView.generateMatchSummary.
  async function generateMatchSummary(params?: { forceRefresh?: boolean }) {
    if (!asset.value?.id) return;
    if (options.canGenerateMatchSummary && !options.canGenerateMatchSummary()) return;
    const narrationCount = narrations.value.length;
    const localState = getMatchSummaryStateFromCount(narrationCount);
    if (localState !== 'normal') {
      matchSummary.value = { state: localState, bullets: [] };
      return;
    }
    if (matchSummary.value?.state !== 'normal') return;

    const activeRequestId = requestId;
    const summaryRequestId = ++matchSummaryRequestId;
    matchSummaryError.value = null;
    matchSummaryLoading.value = true;
    try {
      const next = await analysisService.getMatchSummary(asset.value.id, {
        forceRefresh: Boolean(params?.forceRefresh),
      });
      if (activeRequestId !== requestId) return;
      if (summaryRequestId !== matchSummaryRequestId) return;
      matchSummary.value = next;
    } catch (err) {
      if (activeRequestId !== requestId) return;
      if (summaryRequestId !== matchSummaryRequestId) return;
      matchSummaryError.value = err instanceof Error ? err.message : 'Unable to generate summary.';
    } finally {
      if (summaryRequestId === matchSummaryRequestId) {
        matchSummaryLoading.value = false;
      }
    }
  }

  // Moved from OrgMediaAssetReviewView.load.
  async function reload(): Promise<void> {
    const activeRequestId = ++requestId;
    matchSummaryRequestId += 1;

    const orgId = options.orgId();
    const mediaAssetId = options.mediaAssetId();
    if (!orgId || !mediaAssetId) return;

    loading.value = true;
    error.value = null;
    asset.value = null;
    playlistUrl.value = '';
    segments.value = [];
    narrations.value = [];
    matchSummary.value = null;
    matchSummaryError.value = null;
    matchSummaryLoading.value = false;

    try {
      const found = await mediaService.getById(orgId, mediaAssetId);
      if (activeRequestId !== requestId) return;
      asset.value = found;

      const url = await mediaService.getPresignedHlsPlaylistUrl(orgId, found.id, found.bucket);
      if (activeRequestId !== requestId) return;
      playlistUrl.value = url;

      // Load existing segments and narrations for this asset.
      const [segList, narList] = await Promise.all([
        segmentService.listSegmentsForMediaAsset(found.id),
        narrationService.listNarrationsForMediaAsset(found.id),
      ]);

      if (activeRequestId !== requestId) return;
      segments.value = segList;
      narrations.value = narList;

      const localState = getMatchSummaryStateFromCount(narrations.value.length);
      matchSummary.value = { state: localState, bullets: [] };

      if (localState === 'normal' && options.canGenerateMatchSummary && options.canGenerateMatchSummary()) {
        void generateMatchSummary({ forceRefresh: false });
      }
    } catch (err) {
      if (activeRequestId !== requestId) return;
      error.value = err instanceof Error ? err.message : 'Unable to load review.';
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
    asset,
    playlistUrl,
    segments,
    narrations,
    matchSummary,
    matchSummaryLoading,
    matchSummaryError,
    addSegmentTag,
    removeSegmentTag,
    generateMatchSummary,
    reload,
  };
}

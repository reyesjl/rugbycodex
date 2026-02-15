import { computed, ref, watch } from 'vue';
import { analysisService } from '@/modules/analysis/services/analysisService';
import type { MatchSummary } from '@/modules/analysis/types/MatchSummary';
import type { NarrationListItem } from '@/modules/narrations/composables/useNarrationRecorder';
import type { Narration } from '@/modules/narrations/types/Narration';
import { mediaService } from '@/modules/media/services/mediaService';

import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';
import type { SegmentTag, SegmentTagType } from '@/modules/media/types/SegmentTag';
import { useSegmentTags } from '@/modules/media/composables/useSegmentTags';
import { supabase } from '@/lib/supabaseClient';

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
  const matchSummaryRefreshing = ref(false);
  const matchSummaryError = ref<string | null>(null);
  let requestId = 0;
  let matchSummaryRequestId = 0;

  const MIN_NARRATIONS_FOR_SUMMARY = 25;

  function getMatchSummaryStateFromCount(count: number): MatchSummary['state'] {
    if (count <= 0) return 'empty';
    if (count < MIN_NARRATIONS_FOR_SUMMARY) return 'light';
    return 'normal';
  }

  function hasStoredMatchSummary(summary: MatchSummary | null): boolean {
    if (!summary || summary.state !== 'normal') return false;
    const structured = summary as any;
    const headline = String(structured?.match_headline ?? '').trim();
    const summaryLines = Array.isArray(structured?.match_summary)
      ? structured.match_summary.map((line: any) => String(line ?? '').trim()).filter(Boolean)
      : [];
    const sections = structured?.sections ?? {};
    const hasSections = sections && typeof sections === 'object'
      ? Object.values(sections).some((val) => val && typeof val === 'string' && val.trim().length > 0)
      : false;
    const bullets = Array.isArray(structured?.bullets) ? structured.bullets.filter(Boolean) : [];
    return Boolean(headline || summaryLines.length > 0 || hasSections || bullets.length > 0);
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

  function reloadSegmentTags() {
    return segmentTags.reload();
  }

  async function refreshStaleMatchSummary(assetId: string, activeRequestId: number) {
    if (options.canGenerateMatchSummary && !options.canGenerateMatchSummary()) return;
    const summaryRequestId = ++matchSummaryRequestId;
    matchSummaryRefreshing.value = true;
    try {
      const next = await analysisService.getMatchSummary(assetId, { forceRefresh: true, skipCache: true });
      if (activeRequestId !== requestId) return;
      if (summaryRequestId !== matchSummaryRequestId) return;
      if (hasStoredMatchSummary(next)) {
        matchSummary.value = next;
      }
    } catch (err) {
      if (activeRequestId !== requestId) return;
      if (summaryRequestId !== matchSummaryRequestId) return;
      matchSummaryError.value = err instanceof Error ? err.message : 'Unable to refresh summary.';
    } finally {
      if (summaryRequestId === matchSummaryRequestId) {
        matchSummaryRefreshing.value = false;
      }
    }
  }

  async function loadStoredMatchSummary(assetId: string, activeRequestId: number, narrationCount: number) {
    if (options.canGenerateMatchSummary && !options.canGenerateMatchSummary()) return;
    if (narrationCount < MIN_NARRATIONS_FOR_SUMMARY) return;
    const summaryRequestId = ++matchSummaryRequestId;
    matchSummaryError.value = null;
    matchSummaryLoading.value = true;
    try {
      const next = await analysisService.getMatchSummary(assetId, { forceRefresh: false, skipCache: true });
      if (activeRequestId !== requestId) return;
      if (summaryRequestId !== matchSummaryRequestId) return;
      if (hasStoredMatchSummary(next)) {
        matchSummary.value = next;
        if (next.is_stale) {
          void refreshStaleMatchSummary(assetId, activeRequestId);
        }
      }
    } catch (err) {
      if (activeRequestId !== requestId) return;
      if (summaryRequestId !== matchSummaryRequestId) return;
      matchSummaryError.value = err instanceof Error ? err.message : 'Unable to load summary.';
    } finally {
      if (summaryRequestId === matchSummaryRequestId) {
        matchSummaryLoading.value = false;
      }
    }
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
    matchSummaryRefreshing.value = false;

    try {
      const found = await mediaService.getById(orgId, mediaAssetId);
      if (activeRequestId !== requestId) return;
      asset.value = found;

      const url = await mediaService.getPresignedHlsPlaylistUrl(orgId, found.id, found.bucket);
      if (activeRequestId !== requestId) return;
      playlistUrl.value = url;

      // Load segments, narrations, and tags in single RPC call (2x performance improvement)
      const { data: segmentData, error: segError } = await supabase
        .rpc('rpc_get_media_asset_segments_with_data', {
          p_media_asset_id: found.id,
        });

      if (segError) throw segError;
      if (activeRequestId !== requestId) return;

      // Transform RPC results into segments and narrations
      const segmentsMap = new Map<string, MediaAssetSegment>();
      const narrationsMap = new Map<string, Narration>();
      const segmentTagsMap = new Map<string, SegmentTag[]>();

      for (const row of segmentData ?? []) {
        const segId = String(row.segment_id);
        
        // Build segment (only once per segment_id)
        if (!segmentsMap.has(segId)) {
          segmentsMap.set(segId, {
            id: row.segment_id,
            media_asset_id: found.id,
            segment_index: row.segment_index,
            start_seconds: row.start_seconds,
            end_seconds: row.end_seconds,
            source_type: row.segment_source_type as any,
            created_at: row.segment_created_at,
            tags: [],
          });
        }
        
        // Add narration if present (row.narration_id is null if no narration)
        if (row.narration_id) {
          const narId = String(row.narration_id);
          if (!narrationsMap.has(narId)) {
            narrationsMap.set(narId, {
              id: row.narration_id,
              org_id: found.org_id,
              media_asset_id: found.id,
              media_asset_segment_id: row.segment_id,
              author_id: row.narration_author_id,
              source_type: row.narration_source_type as any,
              transcript_raw: row.narration_transcript_raw,
              transcript_clean: row.narration_transcript_clean,
              created_at: row.narration_created_at,
              updated_at: row.narration_created_at, // Use created_at as fallback
            } as any);
          }
        }
        
        // Add tag if present (identity tags already excluded in RPC)
        if (row.tag_id) {
          if (!segmentTagsMap.has(segId)) {
            segmentTagsMap.set(segId, []);
          }
          segmentTagsMap.get(segId)!.push({
            id: row.tag_id,
            segment_id: row.segment_id,
            tag_type: row.tag_type as any,
            tag_key: row.tag_key,
            created_by: row.tag_created_by,
            created_at: row.tag_created_at,
          } as any);
        }
      }

      // Attach tags to segments
      for (const [segId, segment] of segmentsMap) {
        segment.tags = segmentTagsMap.get(segId) ?? [];
      }

      segments.value = Array.from(segmentsMap.values()).sort(
        (a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0)
      );
      narrations.value = Array.from(narrationsMap.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const narrationCount = narrations.value.length;
      const localState = getMatchSummaryStateFromCount(narrationCount);
      matchSummary.value = { state: localState, bullets: [] };

      void loadStoredMatchSummary(found.id, activeRequestId, narrationCount);

      // Match summary generation is user-triggered to avoid automatic compute on load.
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
    matchSummaryRefreshing,
    matchSummaryError,
    addSegmentTag,
    removeSegmentTag,
    reloadSegmentTags,
    generateMatchSummary,
    reload,
  };
}

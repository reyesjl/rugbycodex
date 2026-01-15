import { ref, watch, type Ref } from 'vue';
import { narrationService, type NarrationSearchResultRow } from '@/modules/narrations/services/narrationService';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';
import type { NarrationListItem } from '@/modules/narration/composables/useNarrationRecorder';

type UseNarrationSearchOptions = {
  segments: Ref<MediaAssetSegment[]>;
  narrations: Ref<NarrationListItem[]>;
};

export function useNarrationSearch(activeOrgId: Ref<string | null>, options: UseNarrationSearchOptions) {
  const searchQuery = ref('');
  const searchResults = ref<MediaAssetSegment[]>([]);
  const searchLoading = ref(false);
  const searchError = ref<string | null>(null);
  const searchMatchNarrationIds = ref<Set<string> | null>(null);

  let searchDebounceId: number | null = null;
  let searchRequestId = 0;

  function extractNarrationId(row: NarrationSearchResultRow): string | null {
    const raw = row?.narration_id ?? row?.narrationId ?? null;
    if (!raw) return null;
    const id = String(raw).trim();
    return id ? id : null;
  }

  function extractSegmentId(row: NarrationSearchResultRow): string | null {
    const raw = row?.media_asset_segment_id ?? row?.segment_id ?? null;
    if (!raw) return null;
    const id = String(raw).trim();
    return id ? id : null;
  }

  function applySearchResults(rows: NarrationSearchResultRow[]) {
    const segmentIds = new Set<string>();
    const narrationIds = new Set<string>();

    for (const row of rows ?? []) {
      const segId = extractSegmentId(row);
      if (segId) segmentIds.add(segId);

      const narrationId = extractNarrationId(row);
      if (narrationId) narrationIds.add(narrationId);
    }

    if (segmentIds.size === 0 && narrationIds.size > 0) {
      for (const n of options.narrations.value ?? []) {
        const narrationId = String((n as any)?.id ?? '').trim();
        if (!narrationId || !narrationIds.has(narrationId)) continue;
        const segId = String((n as any)?.media_asset_segment_id ?? '').trim();
        if (segId) segmentIds.add(segId);
      }
    }

    const nextSegments = (options.segments.value ?? []).filter((seg) => segmentIds.has(String(seg.id)));
    searchResults.value = nextSegments;
    searchMatchNarrationIds.value = narrationIds.size ? narrationIds : null;
  }

  function resetSearchState() {
    searchResults.value = [];
    searchMatchNarrationIds.value = null;
    searchLoading.value = false;
    searchError.value = null;
  }

  function cancelDebounce() {
    if (searchDebounceId !== null) {
      clearTimeout(searchDebounceId);
      searchDebounceId = null;
    }
  }

  async function executeSearch(queryText: string, orgId: string | null, requestId: number) {
    try {
      if (!orgId) {
        throw new Error('Missing active organization.');
      }

      const embedding = await narrationService.generateSearchEmbedding(queryText);
      const rows = await narrationService.searchNarrationsHybrid({
        queryText,
        queryEmbedding: embedding,
        matchCount: 20,
        orgId,
      });

      if (requestId !== searchRequestId) return;
      applySearchResults(rows);
    } catch (err) {
      if (requestId !== searchRequestId) return;
      searchResults.value = [];
      searchMatchNarrationIds.value = null;
      searchError.value = err instanceof Error ? err.message : 'Search failed.';
    } finally {
      if (requestId === searchRequestId) {
        searchLoading.value = false;
      }
    }
  }

  async function runSearch(queryText?: string): Promise<void> {
    cancelDebounce();
    const trimmed = String(queryText ?? searchQuery.value ?? '').trim();
    if (queryText !== undefined) {
      searchQuery.value = trimmed;
    }

    if (!trimmed) {
      searchRequestId += 1;
      resetSearchState();
      return;
    }

    const requestId = ++searchRequestId;
    searchLoading.value = true;
    searchError.value = null;
    await executeSearch(trimmed, activeOrgId.value, requestId);
  }

  function clearSearch() {
    cancelDebounce();
    searchRequestId += 1;
    searchQuery.value = '';
    resetSearchState();
  }

  watch(
    [searchQuery, activeOrgId],
    ([nextQuery, nextOrgId], _prev, onCleanup) => {
      const trimmed = String(nextQuery ?? '').trim();

      cancelDebounce();

      if (!trimmed) {
        searchRequestId += 1;
        resetSearchState();
        return;
      }

      const requestId = ++searchRequestId;
      searchLoading.value = true;
      searchError.value = null;

      searchDebounceId = window.setTimeout(async () => {
        await executeSearch(trimmed, nextOrgId, requestId);
      }, 300);

      onCleanup(() => {
        cancelDebounce();
      });
    }
  );

  return {
    searchQuery,
    searchResults,
    searchLoading,
    searchError,
    searchMatchNarrationIds,
    runSearch,
    clearSearch,
  };
}

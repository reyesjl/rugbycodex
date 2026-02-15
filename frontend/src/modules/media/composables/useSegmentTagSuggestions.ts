import { computed, ref, watch } from 'vue';
import { segmentTagSuggestionService } from '@/modules/media/services/segmentTagSuggestionService';
import type { SegmentTagSuggestion } from '@/modules/media/types/SegmentTagSuggestion';

type SuggestionsBySegmentId = Record<string, SegmentTagSuggestion[]>;

export function useSegmentTagSuggestions(options: { segmentIds: () => string[] }) {
  const suggestionsBySegmentId = ref<SuggestionsBySegmentId>({});
  let requestId = 0;

  const segmentIds = computed(() => options.segmentIds().map((id) => String(id)).filter(Boolean));

  async function reload(): Promise<void> {
    const ids = segmentIds.value;
    const currentRequestId = ++requestId;

    if (ids.length === 0) {
      suggestionsBySegmentId.value = {};
      return;
    }

    try {
      const next = await segmentTagSuggestionService.listSuggestionsForSegments(ids);
      if (currentRequestId !== requestId) return;
      const normalized: SuggestionsBySegmentId = {};
      for (const id of ids) {
        normalized[id] = next[id] ?? [];
      }
      suggestionsBySegmentId.value = normalized;
    } catch {
      // Best-effort hydration; ignore suggestion load failures.
    }
  }

  watch(
    () => segmentIds.value.join('|'),
    () => {
      void reload();
    },
    { immediate: true }
  );

  return {
    suggestionsBySegmentId,
    reload,
  };
}

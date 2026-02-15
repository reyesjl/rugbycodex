import { computed, ref, watch } from 'vue';
import { segmentInsightService } from '@/modules/analysis/services/segmentInsightService';
import type { SegmentInsight } from '@/modules/analysis/types/SegmentInsight';

export type SegmentInsightWithMeta = SegmentInsight & {
  media_segment_id: string;
  narration_count_at_generation?: number | null;
  coach_audio_url?: string | null;
  coach_audio_generated_at?: string | null;
  model?: string | null;
  prompt_version?: string | null;
  generated_at?: string | null;
};

export function useSegmentInsights(options: { segmentIds: () => string[] }) {
  const insightsBySegmentId = ref<Record<string, SegmentInsightWithMeta>>({});
  let requestId = 0;

  const segmentIds = computed(() => options.segmentIds().map((id) => String(id)).filter(Boolean));

  async function reload(): Promise<void> {
    const ids = segmentIds.value;
    const currentRequestId = ++requestId;

    if (ids.length === 0) {
      insightsBySegmentId.value = {};
      return;
    }

    try {
      const next = await segmentInsightService.listInsightsForSegments(ids);
      if (currentRequestId !== requestId) return;
      insightsBySegmentId.value = next;
    } catch {
      // Best-effort hydration; ignore failures.
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
    insightsBySegmentId,
    reload,
  };
}

<script setup lang="ts">
import { computed } from 'vue';
import MatchSummaryBlock from '@/modules/analysis/components/MatchSummaryBlock.vue';
import { formatMinutesSeconds } from '@/lib/duration';
import type { MatchSummaryState } from '@/modules/analysis/types/MatchSummary';
import type {
  MatchMomentumPoint,
  MatchSummarySnapshot,
  MatchThemeDTO,
} from '@/modules/matchOverview/types/MatchOverview';

const props = defineProps<{
  summary: MatchSummarySnapshot | null;
  summaryState: MatchSummaryState;
  narrationCount: number;
  narrationsNeeded: number;
  canGenerate: boolean;
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  timeline: MatchMomentumPoint[];
  themes: MatchThemeDTO[];
}>();

const emit = defineEmits<{ (e: 'generate'): void }>();

const summaryHeadline = computed(() => props.summary?.match_headline ?? null);
const summaryLines = computed(() => props.summary?.match_summary ?? []);
const summarySections = computed(() => props.summary?.sections ?? {});

const hasGenerated = computed(() => {
  return Boolean(summaryHeadline.value || summaryLines.value.length > 0 || Object.keys(summarySections.value).length > 0);
});

const timelineItems = computed(() => props.timeline ?? []);
const themes = computed(() => props.themes ?? []);

function formatBucket(startSeconds: number, endSeconds: number) {
  return `${formatMinutesSeconds(startSeconds)} - ${formatMinutesSeconds(endSeconds)}`;
}
</script>

<template>
  <section class="rounded-lg border border-white/10 bg-white/5 p-6 space-y-6">
    <div class="text-sm font-semibold text-white/80">Match story</div>

    <MatchSummaryBlock
      :state="summaryState"
      :match-headline="summaryHeadline"
      :match-summary-lines="summaryLines"
      :sections="summarySections"
      :loading="loading"
      :refreshing="refreshing"
      :error="error"
      :can-generate="canGenerate"
      :has-generated="hasGenerated"
      :narration-count="narrationCount"
      :narrations-needed="narrationsNeeded"
      summary-label="Match story"
      analyze-label="Generate match story"
      empty-message="Add 25+ narrations to generate a match story."
      @generate="emit('generate')"
    />

    <div v-if="timelineItems.length > 0" class="space-y-3">
      <div class="text-xs uppercase tracking-wider text-white/50">Momentum timeline</div>
      <div class="grid gap-2 text-sm text-white/70 md:grid-cols-2">
        <div
          v-for="(point, idx) in timelineItems"
          :key="`${point.bucket_start_seconds}-${idx}`"
          class="flex items-center justify-between rounded-md border border-white/10 bg-black/30 px-3 py-2"
        >
          <span>{{ formatBucket(point.bucket_start_seconds, point.bucket_end_seconds) }}</span>
          <span class="text-white/50">
            {{ point.narration_count }} narrations · {{ point.segment_count }} segments
          </span>
        </div>
      </div>
    </div>

    <div v-if="themes.length > 0" class="space-y-3">
      <div class="text-xs uppercase tracking-wider text-white/50">Key themes</div>
      <div class="grid gap-2 text-sm text-white/70 md:grid-cols-2">
        <div
          v-for="(theme, idx) in themes"
          :key="`${theme.theme_key}-${idx}`"
          class="rounded-md border border-white/10 bg-black/30 px-3 py-2"
        >
          <div class="font-medium text-white/80">{{ theme.label }}</div>
          <div class="text-xs text-white/50 mt-1">
            Evidence: {{ theme.evidence.tag_keys.join(', ') || 'Tags' }}
            · {{ theme.evidence.narration_count }} narrations
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

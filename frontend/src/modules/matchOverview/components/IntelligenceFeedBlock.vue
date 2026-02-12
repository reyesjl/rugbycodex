<script setup lang="ts">
import { computed } from 'vue';
import { formatMinutesSeconds } from '@/lib/duration';
import type { IntelligenceFeedItemDTO } from '@/modules/matchOverview/types/MatchOverview';

const props = defineProps<{
  items: IntelligenceFeedItemDTO[];
}>();

const items = computed(() => props.items ?? []);

function formatTimeRange(item: IntelligenceFeedItemDTO) {
  return `${formatMinutesSeconds(item.start_seconds)} - ${formatMinutesSeconds(item.end_seconds)}`;
}
</script>

<template>
  <section class="rounded-lg border border-white/10 bg-white/5 p-6 space-y-4">
    <div class="text-sm font-semibold text-white/80">Intelligence feed</div>

    <div v-if="items.length === 0" class="text-sm text-white/50">
      Generate segment insights to build the intelligence feed.
    </div>

    <div v-else class="space-y-3 text-sm text-white/70">
      <div
        v-for="item in items"
        :key="item.segment_id"
        class="rounded-md border border-white/10 bg-black/30 px-3 py-2"
      >
        <div class="flex items-center justify-between text-xs text-white/50">
          <span>Segment {{ item.segment_index + 1 }}</span>
          <span>{{ formatTimeRange(item) }}</span>
        </div>
        <div class="mt-2 font-medium text-white/80">
          {{ item.insight_headline || 'Segment insight' }}
        </div>
        <div class="mt-1 text-sm text-white/70">
          {{ item.insight_sentence || 'No insight text yet.' }}
        </div>
        <div v-if="item.tags.length > 0" class="mt-2 text-xs text-white/50">
          Tags: {{ item.tags.map(tag => tag.tag_key).join(', ') }}
        </div>
      </div>
    </div>
  </section>
</template>

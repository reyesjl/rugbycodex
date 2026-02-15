<script setup lang="ts">
import { computed } from 'vue';
import type { MatchTrendDTO } from '@/modules/matchOverview/types/MatchOverview';

const props = defineProps<{
  trends: MatchTrendDTO[];
}>();

const trends = computed(() => props.trends ?? []);

function formatMetricLabel(key: string) {
  return key.replace(/_/g, ' ');
}

function formatDelta(direction: MatchTrendDTO['direction']) {
  if (direction === 'up') return '▲';
  if (direction === 'down') return '▼';
  return '•';
}
</script>

<template>
  <section class="rounded-lg border border-white/10 bg-white/5 p-6 space-y-4">
    <div class="text-sm font-semibold text-white/80">Trends vs last matches</div>

    <div v-if="trends.length === 0" class="text-sm text-white/50">
      Trends will appear once there are prior matches to compare.
    </div>

    <div v-else class="grid gap-3 text-sm text-white/70 md:grid-cols-2">
      <div
        v-for="trend in trends"
        :key="trend.metric_key"
        class="rounded-md border border-white/10 bg-black/30 px-3 py-2"
      >
        <div class="flex items-center justify-between">
          <span class="capitalize">{{ formatMetricLabel(trend.metric_key) }}</span>
          <span class="text-white/50">{{ formatDelta(trend.direction) }}</span>
        </div>
        <div class="mt-1 text-xs text-white/50">
          Current: {{ trend.current_value }} · Baseline: {{ trend.baseline_value }}
        </div>
        <div class="text-xs text-white/50">
          Δ {{ trend.delta_value }} ({{ trend.sample_size }} matches)
        </div>
      </div>
    </div>
  </section>
</template>

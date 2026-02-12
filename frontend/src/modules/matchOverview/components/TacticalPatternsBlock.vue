<script setup lang="ts">
import { computed } from 'vue';
import type { DistributionDTO, TacticalPatternsDTO } from '@/modules/matchOverview/types/MatchOverview';

const props = defineProps<{
  patterns: TacticalPatternsDTO | null;
}>();

const setPieces = computed<DistributionDTO[]>(() => props.patterns?.set_pieces ?? []);
const actions = computed<DistributionDTO[]>(() => props.patterns?.actions ?? []);
const transitions = computed<DistributionDTO[]>(() => props.patterns?.transitions ?? []);

const hasData = computed(() => {
  return setPieces.value.length > 0 || actions.value.length > 0 || transitions.value.length > 0;
});
</script>

<template>
  <section class="rounded-lg border border-white/10 bg-white/5 p-6 space-y-4">
    <div class="text-sm font-semibold text-white/80">Tactical patterns</div>

    <div v-if="!hasData" class="text-sm text-white/50">
      Tactical patterns will appear once tags and narrations are added.
    </div>

    <div v-else class="grid gap-4 md:grid-cols-3 text-sm text-white/70">
      <div>
        <div class="text-xs uppercase tracking-wider text-white/50 mb-2">Set pieces</div>
        <div v-if="setPieces.length === 0" class="text-white/40">No set piece tags yet.</div>
        <ul v-else class="space-y-2">
          <li v-for="item in setPieces" :key="item.key" class="flex justify-between">
            <span>{{ item.label }}</span>
            <span class="text-white/50">{{ item.segment_count }} · {{ item.percent }}%</span>
          </li>
        </ul>
      </div>

      <div>
        <div class="text-xs uppercase tracking-wider text-white/50 mb-2">Actions</div>
        <div v-if="actions.length === 0" class="text-white/40">No action tags yet.</div>
        <ul v-else class="space-y-2">
          <li v-for="item in actions" :key="item.key" class="flex justify-between">
            <span>{{ item.label }}</span>
            <span class="text-white/50">{{ item.segment_count }} · {{ item.percent }}%</span>
          </li>
        </ul>
      </div>

      <div>
        <div class="text-xs uppercase tracking-wider text-white/50 mb-2">Transitions</div>
        <div v-if="transitions.length === 0" class="text-white/40">No transition tags yet.</div>
        <ul v-else class="space-y-2">
          <li v-for="item in transitions" :key="item.key" class="flex justify-between">
            <span>{{ item.label }}</span>
            <span class="text-white/50">{{ item.segment_count }} · {{ item.percent }}%</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

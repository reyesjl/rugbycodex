<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';

type MatchSummaryState = 'empty' | 'light' | 'normal';

const props = withDefaults(
  defineProps<{
    state: MatchSummaryState;
    bullets?: string[];
    loading?: boolean;
    error?: string | null;
    canGenerate?: boolean;
    hasGenerated?: boolean;
    collapsible?: boolean;
    collapsed?: boolean;
    narrationCount?: number | null;
    narrationsNeeded?: number | null;
  }>(),
  {
    bullets: () => [],
    loading: false,
    error: null,
    canGenerate: false,
    hasGenerated: false,
    collapsible: false,
    collapsed: false,
    narrationCount: null,
    narrationsNeeded: null,
  }
);

const emit = defineEmits<{ (e: 'generate'): void; (e: 'toggle'): void }>();

const hasBullets = computed(() => Array.isArray(props.bullets) && props.bullets.length > 0);

const containerClass = computed(() => {
  const base = 'rounded-lg border bg-slate-800/30 p-4';
  if (props.state === 'empty') {
    return `${base} border-slate-700/50`;
  }
  if (props.state === 'light') {
    return `${base} border-dashed border-slate-700/30`;
  }
  return `${base} border-slate-700/50`;
});

</script>

<template>
  <div :class="containerClass">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <Icon
          v-if="state === 'normal'"
          icon="carbon:ai-generate"
          width="16"
          height="16"
          class="text-slate-400"
        />
        <Icon
          v-else
          icon="carbon:locked"
          width="16"
          height="16"
          class="text-slate-500"
        />
        <div class="text-sm font-semibold text-slate-50 truncate">Match Summary</div>
        <span v-if="collapsible && collapsed" class="text-xs text-slate-500">Summary collapsed</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="collapsible"
          type="button"
          class="text-xs text-slate-400 hover:text-slate-200 transition"
          @click="emit('toggle')"
        >
          <Icon
            :icon="collapsed ? 'carbon:chevron-down' : 'carbon:chevron-up'"
            width="16"
            height="16"
          />
        </button>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="error" class="mt-3 text-xs text-rose-300">
      {{ error }}
    </div>

    <!-- Collapsed state (content hidden) -->
    <div v-else-if="collapsible && collapsed" />

    <!-- Empty/locked states -->
    <div v-else-if="state === 'empty' || state === 'light'" class="mt-3">
      <div class="text-sm text-slate-400">
        Add more narrations to generate summary
        <span v-if="Number.isFinite(narrationCount) && Number.isFinite(narrationsNeeded)">
          ({{ narrationCount }} / {{ narrationsNeeded }})
        </span>
      </div>
    </div>

    <!-- Normal state with content -->
    <div v-else-if="state === 'normal'" class="mt-3">
      <div v-if="loading" class="flex items-center gap-3 text-sm text-slate-300">
          <LoadingDot />
          <ShimmerText text="Rugbycodex is summarizing all your match moments" />
      </div>
      <div v-else-if="hasBullets" class="space-y-2">
        <ul class="space-y-2 text-sm text-slate-300">
          <li v-for="(b, idx) in bullets" :key="idx" class="flex gap-3">
            <span class="text-slate-500 shrink-0">•</span>
            <span class="leading-relaxed">{{ b }}</span>
          </li>
        </ul>
      </div>

      <div v-else class="text-sm text-slate-400">
        Generate summary of team observations
      </div>
    </div>
  </div>
</template>

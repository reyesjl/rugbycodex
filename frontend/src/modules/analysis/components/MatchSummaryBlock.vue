<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

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
  }>(),
  {
    bullets: () => [],
    loading: false,
    error: null,
    canGenerate: false,
    hasGenerated: false,
    collapsible: false,
    collapsed: false,
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

const buttonLabel = computed(() => {
  if (props.loading) return 'Generating…';
  return props.hasGenerated ? 'Regenerate' : 'Generate';
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
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="state === 'normal' && canGenerate"
          type="button"
          class="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 transition"
          :disabled="loading"
          @click="emit('generate')"
        >
          {{ buttonLabel }}
        </button>
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

    <!-- Collapsed state -->
    <div v-else-if="collapsible && collapsed" class="mt-2 text-xs text-slate-400">
      Summary collapsed
    </div>

    <!-- Empty/locked states -->
    <div v-else-if="state === 'empty' || state === 'light'" class="mt-3">
      <div class="text-sm text-slate-400">
        Add more narrations to generate summary
      </div>
    </div>

    <!-- Normal state with content -->
    <div v-else-if="state === 'normal'" class="mt-3">
      <div v-if="hasBullets" class="space-y-2">
        <ul class="space-y-2 text-sm text-slate-300">
          <li v-for="(b, idx) in bullets" :key="idx" class="flex gap-3">
            <span class="text-slate-500 shrink-0">•</span>
            <span class="leading-relaxed">{{ b }}</span>
          </li>
        </ul>
      </div>

      <div v-else class="text-sm text-slate-400">
        {{ loading ? 'Generating summary…' : 'Generate summary of team observations' }}
      </div>
    </div>
  </div>
</template>

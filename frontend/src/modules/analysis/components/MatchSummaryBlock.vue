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
  }>(),
  {
    bullets: () => [],
    loading: false,
    error: null,
    canGenerate: false,
    hasGenerated: false,
  }
);

const emit = defineEmits<{ (e: 'generate'): void }>();

const hasBullets = computed(() => Array.isArray(props.bullets) && props.bullets.length > 0);

const containerClass = computed(() => {
  if (props.state === 'normal') {
    return 'rounded-lg border border-violet-400/25 bg-violet-500/5 p-3 shadow-[0_0_24px_rgba(139,92,246,0.16)]';
  }

  // Locked/quiet states.
  const base = 'rounded-lg border bg-white/5 p-3';
  if (props.state === 'light') {
    return `${base} border-dashed border-white/20 opacity-80`;
  }
  return `${base} border-white/10 opacity-80`;
});

const buttonLabel = computed(() => {
  if (props.loading) return 'Generating…';
  return props.hasGenerated ? 'Regenerate' : 'Generate';
});
</script>

<template>
  <div :class="containerClass">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <Icon
          v-if="state === 'normal'"
          icon="carbon:ai-generate"
          width="16"
          height="16"
          class="text-violet-200"
        />
        <Icon
          v-else
          icon="carbon:locked"
          width="16"
          height="16"
          class="text-white/60"
        />
        <div class="text-sm font-semibold text-white truncate">Match Summary</div>
      </div>

      <button
        v-if="state === 'normal' && canGenerate"
        type="button"
        class="text-xs text-violet-200 hover:text-violet-100 disabled:opacity-50"
        :disabled="loading"
        @click="emit('generate')"
      >
        {{ buttonLabel }}
      </button>
    </div>

    <div v-if="error" class="mt-2 text-xs text-rose-200">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="state === 'empty'" class="mt-2">
      <div class="text-sm text-white/80">No team insights yet.</div>
      <div class="mt-1 text-xs text-white/60">Add narrations to begin building match understanding.</div>
    </div>

    <!-- Light (locked) state -->
    <div v-else-if="state === 'light'" class="mt-2">
      <div class="text-sm text-white/85">Add more narrations to unlock Match Summary.</div>
      <div class="mt-1 text-xs text-white/60">
        Summaries appear once enough feedback is added to identify patterns.
      </div>
    </div>

    <!-- Normal state -->
    <div v-else class="mt-2">
      <div v-if="hasBullets" class="mt-2">
        <ul class="space-y-1 text-sm text-white/90">
          <li v-for="(b, idx) in bullets" :key="idx" class="flex gap-2">
            <span class="text-violet-200">•</span>
            <span class="leading-snug">{{ b }}</span>
          </li>
        </ul>
      </div>

      <div v-else class="text-xs text-white/60">
        {{ loading ? 'Generating…' : 'Generate a short, neutral summary of team observations.' }}
      </div>
    </div>
  </div>
</template>

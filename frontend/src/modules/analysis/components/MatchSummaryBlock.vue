<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import ConfirmNoticeModal from '@/components/ConfirmNoticeModal.vue';

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

const showInfoModal = ref(false);

function openInfoModal() {
  showInfoModal.value = true;
}

function closeInfoModal() {
  showInfoModal.value = false;
}

const containerClass = computed(() => 'rounded-lg border border-slate-700/50 bg-slate-800/30 p-4');

const shouldShowContainer = computed(() => {
  if (props.state !== 'normal') return false;
  if (props.loading) return false;
  return Boolean(props.error || hasBullets.value || props.hasGenerated);
});

const shouldShowAnalyzeButton = computed(() => {
  if (props.state !== 'normal') return false;
  if (props.loading || props.error) return false;
  if (hasBullets.value || props.hasGenerated) return false;
  return Boolean(props.canGenerate);
});

</script>

<template>
  <div v-if="state === 'empty' || state === 'light'" class="text-sm text-slate-400">
    Add more narrations to generate summary
    <span v-if="Number.isFinite(narrationCount) && Number.isFinite(narrationsNeeded)">
      ({{ narrationCount }} / {{ narrationsNeeded }})
    </span>
  </div>

  <button
    v-else-if="shouldShowAnalyzeButton"
    type="button"
    class="inline-flex items-center gap-2 rounded-md border border-blue-400/40 bg-blue-400/10 px-3 py-2 text-sm font-medium text-blue-400 transition hover:bg-blue-400/20"
    @click="emit('generate')"
  >
    Analyze Match
    <Icon icon="carbon:ai-generate" width="16" height="16" />
  </button>

  <div v-else-if="state === 'normal' && loading" class="flex items-center gap-3 text-sm text-slate-300">
    <LoadingDot />
    <ShimmerText text="Rugbycodex is summarizing all your match moments" />
  </div>

  <div v-else-if="shouldShowContainer" :class="containerClass">
    <!-- Header -->
    <component
      :is="collapsible ? 'button' : 'div'"
      class="flex w-full items-center justify-between gap-3 text-left"
      :type="collapsible ? 'button' : undefined"
      @click="collapsible ? emit('toggle') : undefined"
    >
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <Icon
            :icon="collapsed ? 'carbon:chevron-right' : 'carbon:chevron-down'"
            width="16"
            height="16"
            class="text-slate-400"
          />
          <div class="text-sm font-semibold text-slate-50 truncate">Match summary</div>
        </div>
        <div
          v-if="(hasBullets || hasGenerated) && Number.isFinite(narrationCount)"
          class="mt-1 ml-6 flex items-center gap-2 border-l-2 border-blue-400/60 pl-1 text-xs text-slate-400"
        >
          <span>Based on {{ narrationCount }} narrations.</span>
          <button
            type="button"
            class="inline-flex cursor-pointer gap-1 items-center justify-center text-slate-400 transition hover:text-slate-200"
            @click.stop="openInfoModal"
            aria-label="How match summary works"
          >Click
            <Icon icon="carbon:information" width="14" height="14" /> to learn more.
          </button>
        </div>
      </div>
      <Icon icon="carbon:ai-generate" width="16" height="16" class="text-slate-400" />
    </component>

    <!-- Error state -->
    <div v-if="error" class="mt-3 text-xs text-rose-300">
      {{ error }}
    </div>

    <!-- Collapsed state (content hidden) -->
    <div v-else-if="collapsible && collapsed" />

    <!-- Normal state with content -->
    <div v-else class="mt-3">
      <div v-if="hasBullets" class="space-y-2">
        <ul class="space-y-2 text-sm text-slate-300">
          <li v-for="(b, idx) in bullets" :key="idx" class="flex gap-3">
            <span class="text-slate-500 shrink-0">•</span>
            <span class="leading-relaxed">{{ b }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>

  <ConfirmNoticeModal
    :show="showInfoModal"
    popup-title="Learn more"
    message="Match summaries are generated from the narrations added to this match. As more narrations are added, the summary becomes more accurate and reflective of what happened."
    button-label="Okay"
    @close="closeInfoModal"
  />
</template>

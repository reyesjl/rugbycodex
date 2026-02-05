<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import ConfirmNoticeModal from '@/components/ConfirmNoticeModal.vue';

type MatchSummaryState = 'empty' | 'light' | 'normal';

type MatchAnalysisSection = {
  key: string;
  title: string;
  summary: string;
};

const props = withDefaults(
  defineProps<{
    state: MatchSummaryState;
    bullets?: string[];
    matchSignature?: string[];
    sections?: {
      set_piece?: string | null;
      territory?: string | null;
      possession?: string | null;
      defence?: string | null;
      kick_battle?: string | null;
      scoring?: string | null;
    };
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
    matchSignature: () => [],
    sections: () => ({}),
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

// Support both legacy bullets and new structured format
const hasLegacyBullets = computed(() => Array.isArray(props.bullets) && props.bullets.length > 0);
const hasMatchSignature = computed(() => Array.isArray(props.matchSignature) && props.matchSignature.length > 0);
const hasBullets = computed(() => hasLegacyBullets.value || hasMatchSignature.value);

// Section metadata
const sectionMetadata: Record<string, string> = {
  set_piece: 'Set Piece & Launch',
  territory: 'Territory & Pressure',
  possession: 'Possession & Breakdown',
  defence: 'Defence & Contact',
  kick_battle: 'Kick Battle & Transition',
  scoring: 'Scoring & Threat Creation',
};

// Build array of available sections with data
const availableSections = computed((): MatchAnalysisSection[] => {
  if (!props.sections) return [];
  
  const sections: MatchAnalysisSection[] = [];
  const orderedKeys = ['set_piece', 'territory', 'possession', 'defence', 'kick_battle', 'scoring'];
  
  for (const key of orderedKeys) {
    const summary = props.sections[key as keyof typeof props.sections];
    if (summary && typeof summary === 'string' && summary.trim().length > 0) {
      sections.push({
        key,
        title: sectionMetadata[key] || key,
        summary: summary.trim(),
      });
    }
  }
  
  return sections;
});

const hasStructuredContent = computed(() => hasMatchSignature.value || availableSections.value.length > 0);

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
  return Boolean(props.error || hasBullets.value || hasStructuredContent.value || props.hasGenerated);
});

const shouldShowAnalyzeButton = computed(() => {
  if (props.state !== 'normal') return false;
  if (props.loading || props.error) return false;
  if (hasBullets.value || hasStructuredContent.value || props.hasGenerated) return false;
  return Boolean(props.canGenerate);
});

</script>

<template>
  <div v-if="state === 'empty' || state === 'light'" class="text-sm text-slate-400">
    Add 25+ narrations to generate summary
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

    <!-- Content -->
    <div v-else class="mt-4">
      <!-- Match Signature (always visible, not expandable) -->
      <div v-if="hasMatchSignature" class="mb-4">
        <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Match Signature
        </div>
        <ul class="space-y-2 text-sm text-slate-300">
          <li v-for="(bullet, idx) in matchSignature" :key="idx" class="flex gap-3">
            <span class="text-slate-500 shrink-0">•</span>
            <span class="leading-relaxed">{{ bullet }}</span>
          </li>
        </ul>
      </div>

      <!-- Legacy bullets (backward compatibility) -->
      <div v-else-if="hasLegacyBullets" class="mb-4">
        <ul class="space-y-2 text-sm text-slate-300">
          <li v-for="(b, idx) in bullets" :key="idx" class="flex gap-3">
            <span class="text-slate-500 shrink-0">•</span>
            <span class="leading-relaxed">{{ b }}</span>
          </li>
        </ul>
      </div>

      <!-- Analysis Sections (expandable with Headless UI) -->
      <div v-if="availableSections.length > 0" class="space-y-2">
        <Disclosure
          v-for="section in availableSections"
          :key="section.key"
          v-slot="{ open }"
          as="div"
          class="rounded-md border border-slate-700/40 bg-slate-800/20"
        >
          <DisclosureButton
            class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-slate-700/20"
          >
            <span class="text-sm font-medium text-slate-200">{{ section.title }}</span>
            <Icon
              :icon="open ? 'carbon:chevron-up' : 'carbon:chevron-down'"
              width="16"
              height="16"
              class="text-slate-400 transition-transform shrink-0"
            />
          </DisclosureButton>
          <DisclosurePanel class="px-3 pb-3 pt-1">
            <p class="text-sm leading-relaxed text-slate-300">
              {{ section.summary }}
            </p>
          </DisclosurePanel>
        </Disclosure>
      </div>
    </div>
  </div>

  <ConfirmNoticeModal
    :show="showInfoModal"
    popup-title="Match summaries"
    message="Each narration captures a perspective on what happened. Together, they form a shared picture of the match. As more narrations are added, the summary becomes richer, clearer, and more representative of what actually unfolded."
    button-label="Got it"
    @close="closeInfoModal"
  />
</template>

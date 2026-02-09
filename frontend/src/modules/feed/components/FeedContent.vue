<script setup lang="ts">
import { computed } from 'vue';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import type { SegmentTag } from '@/modules/media/types/SegmentTag';
import type { NarrationListItem } from '@/modules/narrations/composables/useNarrationRecorder';
import type { OrgRole } from '@/modules/orgs/types/OrgRole';
import NarrationPanel from '@/modules/narrations/components/NarrationPanel.vue';

const props = withDefaults(
  defineProps<{
    // Tags
    tags?: SegmentTag[];
    profileNameById?: Record<string, string>;
    currentUserId?: string | null;
    
    // Narrations
    narrations?: NarrationListItem[];
    loadingNarrations?: boolean;
    submittingNarration?: boolean;
    submitError?: string | null;
    currentUserRole?: OrgRole | null;
    
    // Insight
    insightHeadline?: string | null;
    insightSentence?: string | null;
    insightCoachScript?: string | null;
    insightPlaceholder?: string | null;
    insightLoading?: boolean;
    insightError?: string | null;
    insightCanGenerate?: boolean;
    insightHasGenerated?: boolean;
    insightNarrationCount?: number | null;
  }>(),
  {
    tags: () => [],
    profileNameById: () => ({}),
    currentUserId: null,
    narrations: () => [],
    loadingNarrations: false,
    submittingNarration: false,
    submitError: null,
    currentUserRole: null,
    insightHeadline: null,
    insightSentence: null,
    insightCoachScript: null,
    insightPlaceholder: null,
    insightLoading: false,
    insightError: null,
    insightCanGenerate: false,
    insightHasGenerated: false,
    insightNarrationCount: null,
  }
);

const emit = defineEmits<{
  (e: 'submitText', text: string): void;
  (e: 'updateText', payload: { id: string; transcriptRaw: string }): void;
  (e: 'delete', id: string): void;
  (e: 'selectNarration', id: string): void;
  (e: 'generateInsight'): void;
}>();

const tagList = computed(() => props.tags ?? []);

// Separate identity tags from other tags (action + context together)
const identityTags = computed(() => tagList.value.filter((tag) => tag.tag_type === 'identity'));
const otherTags = computed(() => tagList.value.filter((tag) => tag.tag_type !== 'identity'));

const insightHeadlineText = computed(() => props.insightHeadline || 'Insight');
const insightSentenceText = computed(() => {
  if (props.insightSentence) return props.insightSentence;
  return props.insightPlaceholder || '';
});
const isInsightPlaceholder = computed(() => !props.insightSentence && !props.insightLoading);
const showGenerateInsight = computed(() => {
  if (!props.insightCanGenerate) return false;
  if (props.insightLoading || props.insightHasGenerated) return false;
  return (props.insightNarrationCount ?? 0) >= 1;
});

function formatTagLabel(tag: SegmentTag): string {
  const raw = String(tag.tag_key ?? '').replace(/_/g, ' ').trim();
  
  if (tag.tag_type === 'identity') {
    // Show "you" if it's the current user
    if (props.currentUserId && String(tag.created_by) === String(props.currentUserId)) return 'you';
    
    // Show profile name if available
    const profileId = tag.created_by ? String(tag.created_by) : '';
    const profileName = profileId ? props.profileNameById?.[profileId] : '';
    if (profileName) return profileName;
    
    // Fallback
    if (raw && raw !== 'self') return raw;
    return 'player';
  }
  
  // For action/context tags, just return the formatted key
  return raw || String(tag.tag_type ?? '').toLowerCase();
}

function classForTag(tag: SegmentTag): string {
  const type = String(tag.tag_type ?? '');
  if (type === 'action') return 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-200/20';
  if (type === 'context') return 'bg-sky-500/15 text-sky-100 ring-1 ring-sky-200/20';
  if (type === 'identity') return 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-200/20';
  return 'bg-white/10 text-white/80 ring-1 ring-white/15';
}
</script>

<template>
  <div class="px-4 py-3 space-y-4">
    <button
      type="button"
      class="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
    >
      Hear coach
      <Icon icon="carbon:play-filled" width="16" height="16" class="text-white/70" />
    </button>
    
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm font-semibold text-white">
          {{ insightHeadlineText }}
        </div>
        <button
          v-if="showGenerateInsight"
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-blue-400/40 bg-blue-400/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition hover:bg-blue-400/20"
          @click="emit('generateInsight')"
        >
          Generate insight
          <Icon icon="carbon:ai-generate" width="14" height="14" />
        </button>
      </div>
      <div v-if="insightLoading" class="flex items-center gap-2 text-sm text-white/70">
        <LoadingDot />
        <ShimmerText text="Rugbycodex is generating insight" />
      </div>
      <p v-else class="text-sm" :class="isInsightPlaceholder ? 'text-white/50' : 'text-white/70'">
        {{ insightSentenceText }}
      </p>
      <p v-if="insightError" class="text-xs text-rose-300">{{ insightError }}</p>
    </div>
    
    <div class="space-y-2">
      <Disclosure v-slot="{ open }">
        <DisclosureButton
          class="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <span>What Coaches &amp; Players Said</span>
          <Icon
            :icon="open ? 'carbon:chevron-up' : 'carbon:chevron-down'"
            width="16"
            height="16"
            class="text-white/60"
          />
        </DisclosureButton>
        <DisclosurePanel class="pt-3">
          <div v-if="loadingNarrations" class="text-sm text-white/50">Loading narrations…</div>
          <NarrationPanel
            v-else
            :narrations="narrations"
            :submitting="submittingNarration"
            :submit-error="submitError"
            :current-user-id="currentUserId"
            :current-user-role="currentUserRole"
            @submitText="emit('submitText', $event)"
            @updateText="emit('updateText', $event)"
            @delete="emit('delete', $event)"
            @selectNarration="emit('selectNarration', $event)"
          />
        </DisclosurePanel>
      </Disclosure>
      
      <Disclosure v-slot="{ open }">
        <DisclosureButton
          class="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <span>Who was involved</span>
          <Icon
            :icon="open ? 'carbon:chevron-up' : 'carbon:chevron-down'"
            width="16"
            height="16"
            class="text-white/60"
          />
        </DisclosureButton>
        <DisclosurePanel class="pt-3">
          <div v-if="identityTags.length === 0" class="text-sm text-white/50">
            No players tagged yet.
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <div
              v-for="tag in identityTags"
              :key="String(tag.id)"
              class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide"
              :class="classForTag(tag)"
            >
              {{ formatTagLabel(tag) }}
            </div>
          </div>
        </DisclosurePanel>
      </Disclosure>
      
      <Disclosure v-slot="{ open }">
        <DisclosureButton
          class="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <span>Tags &amp; Context</span>
          <Icon
            :icon="open ? 'carbon:chevron-up' : 'carbon:chevron-down'"
            width="16"
            height="16"
            class="text-white/60"
          />
        </DisclosureButton>
        <DisclosurePanel class="pt-3">
          <div v-if="otherTags.length === 0" class="text-sm text-white/50">
            No tags yet.
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <div
              v-for="tag in otherTags"
              :key="String(tag.id)"
              class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide"
              :class="classForTag(tag)"
            >
              {{ formatTagLabel(tag) }}
            </div>
          </div>
        </DisclosurePanel>
      </Disclosure>
    </div>
  </div>
</template>

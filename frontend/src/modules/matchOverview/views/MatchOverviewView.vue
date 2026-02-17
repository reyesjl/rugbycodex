<script setup lang="ts">
import { computed, ref } from 'vue';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { hasOrgAccess } from '@/modules/orgs/composables/useOrgCapabilities';
import { formatMediaAssetNameForDisplay } from '@/modules/media/utils/assetUtilities';
import { analysisService } from '@/modules/analysis/services/analysisService';
import type { MatchSummaryState } from '@/modules/analysis/types/MatchSummary';
import type { MembershipRole } from '@/modules/profiles/types';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import MatchStoryBlock from '@/modules/matchOverview/components/MatchStoryBlock.vue';
import MatchRagChat from '@/modules/matchOverview/components/MatchRagChat.vue';
import TacticalPatternsBlock from '@/modules/matchOverview/components/TacticalPatternsBlock.vue';
import PlayerImpactBlock from '@/modules/matchOverview/components/PlayerImpactBlock.vue';
import TrendsBlock from '@/modules/matchOverview/components/TrendsBlock.vue';
import IntelligenceFeedBlock from '@/modules/matchOverview/components/IntelligenceFeedBlock.vue';
import { useMatchOverview } from '@/modules/matchOverview/composables/useMatchOverview';

const MIN_NARRATIONS_FOR_SUMMARY = 25;

const route = useRoute();
const router = useRouter();
const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);
const membershipRole = computed<MembershipRole | null>(() => orgContext.value?.membership?.role ?? null);
const canGenerateSummary = computed(() => hasOrgAccess(membershipRole.value, 'staff'));
const orgSlug = computed(() => String(route.params.slug ?? '').trim());

const mediaAssetId = computed(() => String(route.params.mediaAssetId ?? ''));

const overviewData = useMatchOverview({
  orgId: () => activeOrgId.value,
  mediaAssetId: () => mediaAssetId.value,
  trendWindow: () => 3,
  feedLimit: () => 20,
});

const { overview, loading, error, reload } = overviewData;

const matchTitle = computed(() => {
  const fileName = overview.value?.match?.file_name ?? '';
  const formatted = formatMediaAssetNameForDisplay(fileName);
  return formatted || 'Match overview';
});

const matchDateLabel = computed(() => {
  const createdAt = overview.value?.match?.created_at;
  if (!createdAt) return '';
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
});

const narrationCount = computed(() => overview.value?.counts?.narration_count ?? 0);
const segmentCount = computed(() => overview.value?.counts?.segment_count ?? 0);

const summaryState = computed<MatchSummaryState>(() => {
  const summaryState = overview.value?.story?.summary?.state;
  if (summaryState) return summaryState;
  if (narrationCount.value <= 0) return 'empty';
  if (narrationCount.value < MIN_NARRATIONS_FOR_SUMMARY) return 'light';
  return 'normal';
});

const summaryLoading = ref(false);
const summaryError = ref<string | null>(null);

async function handleGenerateSummary() {
  if (!mediaAssetId.value) return;
  if (!canGenerateSummary.value) return;
  summaryError.value = null;
  summaryLoading.value = true;
  try {
    await analysisService.getMatchSummary(mediaAssetId.value, { forceRefresh: true, skipCache: true });
    await reload({ forceRefresh: true });
  } catch (err) {
    summaryError.value = err instanceof Error ? err.message : 'Unable to generate match summary.';
  } finally {
    summaryLoading.value = false;
  }
}

async function handleRefreshOverview() {
  await reload({ forceRefresh: true });
}

function handleReviewMatch() {
  if (!orgSlug.value || !mediaAssetId.value) return;
  router.push({
    name: 'OrgMediaAssetReview',
    params: {
      slug: orgSlug.value,
      mediaAssetId: mediaAssetId.value,
    },
  });
}

function handleWatchFeed() {
  if (!orgSlug.value || !mediaAssetId.value) return;
  router.push({
    name: 'OrgFeedMomentsView',
    params: {
      slug: orgSlug.value,
      mediaAssetId: mediaAssetId.value,
    },
  });
}

</script>

<template>
  <div class="container py-6 pb-20 text-white space-y-6">
    <div v-if="loading" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      <div class="flex items-center gap-3">
        <LoadingDot />
        <ShimmerText class="text-sm text-white/70" text="Loading match overview..." />
      </div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-white/10 bg-white/5 p-6 text-red-200">
      {{ error }}
    </div>

    <div v-else-if="!overview" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Match overview unavailable.
    </div>

    <div v-else class="space-y-6">
      <header class="flex flex-col gap-2">
        <div class="text-3xl text-white">{{ matchTitle }}</div>
        <div class="text-sm text-white/50">
          {{ matchDateLabel }}
          <span v-if="matchDateLabel">·</span>
          {{ narrationCount }} narrations · {{ segmentCount }} segments
        </div>
        <Menu as="div" class="relative inline-block text-left">
          <MenuButton
            class="inline-flex items-center justify-center rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white transition"
          >
            <Icon icon="carbon:overflow-menu-vertical" class="h-5 w-5" />
          </MenuButton>
          <transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <MenuItems
              class="absolute left-0 z-50 mt-1 w-44 origin-top-left rounded-md border border-white/20 bg-black/95 backdrop-blur shadow-lg focus:outline-none"
            >
              <div class="py-1">
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    class="block w-full px-3 py-2 text-left text-sm text-white/80"
                    :class="active ? 'bg-white/10 text-white' : ''"
                    @click="handleReviewMatch"
                  >
                    Review match
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    class="block w-full px-3 py-2 text-left text-sm text-white/80"
                    :class="active ? 'bg-white/10 text-white' : ''"
                    @click="handleWatchFeed"
                  >
                    Watch feed
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    class="block w-full px-3 py-2 text-left text-sm text-white/80"
                    :class="active ? 'bg-white/10 text-white' : ''"
                    @click="handleRefreshOverview"
                  >
                    Refresh overview
                  </button>
                </MenuItem>
              </div>
            </MenuItems>
          </transition>
        </Menu>
      </header>

      <MatchRagChat :media-asset-id="mediaAssetId" />

      <MatchStoryBlock
        :summary="overview.story.summary"
        :summary-state="summaryState"
        :narration-count="narrationCount"
        :narrations-needed="MIN_NARRATIONS_FOR_SUMMARY"
        :can-generate="canGenerateSummary"
        :loading="summaryLoading"
        :error="summaryError"
        :timeline="overview.story.momentum_timeline"
        :themes="overview.story.themes"
        @generate="handleGenerateSummary"
      />


      <TacticalPatternsBlock :patterns="overview.tactical_patterns" />

      <PlayerImpactBlock :players="overview.player_impact" />

      <TrendsBlock :trends="overview.trends" />

      <IntelligenceFeedBlock :items="overview.intelligence_feed" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
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
import TacticalPatternsBlock from '@/modules/matchOverview/components/TacticalPatternsBlock.vue';
import PlayerImpactBlock from '@/modules/matchOverview/components/PlayerImpactBlock.vue';
import TrendsBlock from '@/modules/matchOverview/components/TrendsBlock.vue';
import IntelligenceFeedBlock from '@/modules/matchOverview/components/IntelligenceFeedBlock.vue';
import { useMatchOverview } from '@/modules/matchOverview/composables/useMatchOverview';

const MIN_NARRATIONS_FOR_SUMMARY = 25;

const route = useRoute();
const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);
const membershipRole = computed<MembershipRole | null>(() => orgContext.value?.membership?.role ?? null);
const canGenerateSummary = computed(() => hasOrgAccess(membershipRole.value, 'staff'));

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
</script>

<template>
  <div class="container-lg py-6 pb-20 text-white space-y-6">
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
      <header class="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-6">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div class="text-2xl font-semibold text-white">{{ matchTitle }}</div>
            <div class="text-sm text-white/50">
              {{ matchDateLabel }}
              <span v-if="matchDateLabel">·</span>
              {{ narrationCount }} narrations · {{ segmentCount }} segments
            </div>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-md border border-blue-400/40 bg-blue-400/10 px-3 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-400/20"
            @click="handleRefreshOverview"
          >
            Refresh overview
          </button>
        </div>
      </header>

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

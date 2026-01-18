<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import { formatDaysAgo } from '@/lib/date';
import { CDN_BASE } from '@/lib/cdn';
import { useActiveOrganizationStore } from '../stores/useActiveOrganizationStore';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { assignmentsService } from '@/modules/assignments/services/assignmentsService';
import { groupsService } from '@/modules/groups/services/groupsService';
import { mediaService } from '@/modules/media/services/mediaService';
import { segmentService } from '@/modules/media/services/segmentService';
import { narrationService } from '@/modules/narrations/services/narrationService';
import type { FeedAssignment, OrgAssignmentListItem } from '@/modules/assignments/types/Assignment';
import type { Narration } from '@/modules/narrations/types/Narration';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import OrgOverviewHeader from '@/modules/orgs/components/OrgOverviewHeader.vue';
import OrgOverviewActivityList from '@/modules/orgs/components/OrgOverviewActivityList.vue';
import OrgOverviewQuickActions from '@/modules/orgs/components/OrgOverviewQuickActions.vue';

type RecentSignalItem = {
  id: string;
  label: string;
  timeLabel: string;
  typeLabel: string;
  icon: string;
  to: RouteLocationRaw;
};

type MatchCoverage = {
  id: string;
  title: string;
  createdAt: Date;
  dateLabel: string;
  thumbnailUrl: string | null;
  totalSegments: number;
  narratedSegments: number;
  coverageRatio: number;
  coverageState: 'covered' | 'partial' | 'needs_review';
  coverageLabel: string;
  to: RouteLocationRaw;
};

type GroupSummary = {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string | null;
};

type QuickAction = {
  id: string;
  label: string;
  description?: string;
  icon: string;
  to: RouteLocationRaw;
};

const authStore = useAuthStore();
const { user } = storeToRefs(authStore);

const activeOrganizationStore = useActiveOrganizationStore();
const { orgContext, resolving, memberCount } = storeToRefs(activeOrganizationStore);

const org = computed(() => orgContext.value?.organization ?? null);
const orgId = computed(() => org.value?.id ?? null);
const orgSlug = computed(() => org.value?.slug ?? null);
const orgRouteParams = computed(() => ({ slug: orgSlug.value ?? '' }));

const role = computed(() => orgContext.value?.membership?.role ?? null);
const canManage = computed(() => {
  if (authStore.isAdmin) return true;
  return role.value === 'owner' || role.value === 'manager' || role.value === 'staff';
});

const overviewLoading = ref(false);
const overviewError = ref<string | null>(null);

const recentSignals = ref<RecentSignalItem[]>([]);
const lastSeenAt = ref<Date | null>(null);
const allNarrations = ref<Narration[]>([]);
const matchSummaries = ref<MatchCoverage[]>([]);

const memberAssignments = ref<FeedAssignment[]>([]);
const memberCompletedAssignments = ref<FeedAssignment[]>([]);
const memberGroups = ref<GroupSummary[]>([]);
const orgAssignments = ref<OrgAssignmentListItem[]>([]);
const completedAssignmentIds = ref<string[]>([]);

const formatPreview = (value: string, maxLength = 120) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
};

const formatRelative = (value: string | Date | null | undefined) => formatDaysAgo(value) ?? 'date unknown';

const formatMatchDate = (value: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(value);

const formatDueStatus = (value: string | null | undefined) => {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Due date unknown';
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / 86_400_000);
  if (diffDays > 1) return `Due in ${diffDays} days`;
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays === 0) return 'Due today';
  const overdueDays = Math.abs(Math.floor(diffMs / 86_400_000));
  return overdueDays <= 1 ? 'Overdue' : `Overdue ${overdueDays} days`;
};

const getAssignmentUrgency = (value: string | null | undefined) => {
  if (!value) return 'undated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'undated';
  const diffMs = date.getTime() - Date.now();
  if (diffMs < 0) return 'overdue';
  const diffDays = diffMs / 86_400_000;
  if (diffDays <= 7) return 'due_soon';
  return 'upcoming';
};

const toTimestamp = (value: string | Date | null | undefined) => {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const toGroupSummary = (entry: { group: { id: string; name: string; created_at: string }; memberIds: string[] }): GroupSummary => ({
  id: entry.group.id,
  name: entry.group.name,
  memberCount: entry.memberIds.length,
  createdAt: entry.group.created_at ?? null,
});

const quickActions = computed<QuickAction[]>(() => {
  if (!orgSlug.value) return [];
  return [
    {
      id: 'upload-media',
      label: 'Upload Media',
      description: 'Send new footage to the org vault.',
      icon: 'carbon:upload',
      to: { name: 'OrgMedia', params: { slug: orgSlug.value } },
    },
    {
      id: 'create-group',
      label: 'Create Group',
      description: 'Segment members into focused squads.',
      icon: 'carbon:group',
      to: { name: 'OrgGroups', params: { slug: orgSlug.value } },
    },
    {
      id: 'invite-member',
      label: 'Invite Member',
      description: 'Add new staff or players.',
      icon: 'carbon:user-follow',
      to: { name: 'OrgMembers', params: { slug: orgSlug.value } },
    },
  ];
});

const completedAssignmentIdSet = computed(() => new Set(completedAssignmentIds.value.map((id) => String(id))));

const overdueAssignments = computed(() =>
  orgAssignments.value
    .filter((assignment) =>
      !completedAssignmentIdSet.value.has(String(assignment.id)) &&
      getAssignmentUrgency(assignment.due_at) === 'overdue'
    )
    .slice(0, 4)
);

const recentCompletedAssignments = computed(() => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return memberCompletedAssignments.value
    .filter((assignment) =>
      assignment.completed &&
      assignment.completed_at &&
      new Date(assignment.completed_at) >= cutoff
    )
    .slice(0, 4);
});

const reviewSignals = computed(() => {
  if (!canManage.value) return [] as string[];
  const signals: string[] = [];
  const lowCoverageCount = matchSummaries.value.filter((match) => match.coverageState !== 'covered').length;
  if (lowCoverageCount > 0) {
    signals.push(`${lowCoverageCount} recent match${lowCoverageCount === 1 ? '' : 'es'} still need narration coverage.`);
  }

  const coachNarrations = allNarrations.value.filter((narration) =>
    narration.source_type === 'coach' || narration.source_type === 'staff'
  );
  const lastCoachNarration = coachNarrations
    .map((n) => n.created_at)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (!lastCoachNarration) {
    signals.push('No coach narrations have been added yet.');
  } else {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    if (lastCoachNarration < threeDaysAgo) {
      signals.push('No coach narrations added in the last 3 days.');
    }
  }

  const recentNarrations = allNarrations.value.filter((n) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return n.created_at >= cutoff;
  });
  const focusKeywords = ['breakdown', 'defense', 'scrum', 'lineout', 'tackle', 'ruck', 'kick', 'maul'];
  const keywordCounts = new Map<string, number>();
  for (const narration of recentNarrations) {
    const text = `${narration.transcript_clean ?? ''} ${narration.transcript_raw ?? ''}`.toLowerCase();
    for (const keyword of focusKeywords) {
      if (text.includes(keyword)) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
      }
    }
  }
  const mostMentioned = [...keywordCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (mostMentioned && mostMentioned[1] >= 3) {
    signals.push(`“${mostMentioned[0]}” is coming up repeatedly in narrations.`);
  }

  return signals;
});

const getMatchTitle = (asset: OrgMediaAsset) => {
  if (asset.title?.trim()) return asset.title.trim();
  const fileName = asset.file_name ?? '';
  const lastSegment = fileName.split('/').pop() ?? fileName;
  const withoutExtension = lastSegment.replace(/\.[^/.]+$/, '');
  return withoutExtension.replace(/[-_]+/g, ' ').trim() || 'Untitled match';
};

const buildCoverageSummary = (
  asset: OrgMediaAsset,
  segments: Array<{ id: string }>,
  narrations: Narration[]
): MatchCoverage => {
  const totalSegments = segments.length;
  const narratedSegments = new Set(narrations.map((n) => n.media_asset_segment_id)).size;
  const coverageRatio = totalSegments > 0 ? narratedSegments / totalSegments : 0;
  let coverageState: MatchCoverage['coverageState'] = 'needs_review';
  if (totalSegments < 5) {
    coverageState = 'needs_review';
  } else if (narratedSegments < 5) {
    coverageState = 'needs_review';
  } else if (coverageRatio >= 0.75 && narratedSegments >= 15) {
    coverageState = 'covered';
  } else {
    coverageState = 'partial';
  }

  const isFullyNarratedButThin =
    totalSegments > 0 &&
    narratedSegments === totalSegments &&
    narratedSegments < 15;

  const coverageLabel = totalSegments > 0
    ? isFullyNarratedButThin
      ? 'All segments narrated — more review needed'
      : `${totalSegments} segments\n${narratedSegments} narrations`
    : 'No segments found';

  const thumbnailUrl = asset.thumbnail_path ? `${CDN_BASE}/${asset.thumbnail_path}` : null;

  return {
    id: asset.id,
    title: getMatchTitle(asset),
    createdAt: asset.created_at,
    dateLabel: formatMatchDate(asset.created_at),
    thumbnailUrl,
    totalSegments,
    narratedSegments,
    coverageRatio,
    coverageState,
    coverageLabel,
    to: { name: 'OrgMediaAssetReview', params: { ...orgRouteParams.value, mediaAssetId: asset.id } },
  };
};

const buildRecentSignals = (
  narrations: Narration[],
  mediaAssets: OrgMediaAsset[],
  assignments: OrgAssignmentListItem[],
  lastSeen: Date | null
): RecentSignalItem[] => {
  const assignmentRouteName = canManage.value ? 'OrgAssignments' : 'OrgFeed';
  const cutoff = lastSeen ? lastSeen.getTime() : 0;
  const items: Array<{ sortKey: number; priority: number; item: RecentSignalItem }> = [];

  for (const narration of narrations) {
    const createdAt = toTimestamp(narration.created_at);
    if (createdAt <= cutoff) continue;
    const content = narration.transcript_clean ?? narration.transcript_raw ?? '';
    const label = formatPreview(content, 110) || 'Narration added';
    items.push({
      sortKey: createdAt,
      priority: 1,
      item: {
        id: narration.id,
        label,
        timeLabel: formatRelative(narration.created_at),
        typeLabel: 'Narration',
        icon: 'carbon:microphone',
        to: {
          name: 'OrgFeedView',
          params: orgRouteParams.value,
          query: {
            source: 'segment',
            segmentId: narration.media_asset_segment_id,
          },
        },
      },
    });
  }

  for (const assignment of assignments) {
    const createdAt = toTimestamp(assignment.created_at);
    if (createdAt <= cutoff) continue;
    const assignmentQuery = assignmentRouteName === 'OrgAssignments'
      ? { assignmentId: assignment.id }
      : undefined;
    items.push({
      sortKey: createdAt,
      priority: 1,
      item: {
        id: assignment.id,
        label: assignment.title,
        timeLabel: formatRelative(assignment.created_at),
        typeLabel: 'Assignment',
        icon: 'carbon:task',
        to: {
          name: assignmentRouteName,
          params: orgRouteParams.value,
          query: assignmentQuery,
        },
      },
    });
  }

  for (const asset of mediaAssets) {
    const createdAt = toTimestamp(asset.created_at);
    if (createdAt <= cutoff) continue;
    const label = (asset.title ?? asset.file_name).trim() || 'Media upload';
    items.push({
      sortKey: createdAt,
      priority: 2,
      item: {
        id: asset.id,
        label,
        timeLabel: formatRelative(asset.created_at),
        typeLabel: 'Media',
        icon: 'carbon:video',
        to: {
          name: 'OrgMediaAsset',
          params: { ...orgRouteParams.value, mediaId: asset.id },
        },
      },
    });
  }

  return items
    .sort((a, b) => a.priority - b.priority || b.sortKey - a.sortKey)
    .slice(0, 5)
    .map(({ item }) => item);
};

const loadOverview = async () => {
  if (!orgId.value) return;
  const activeOrgId = orgId.value;
  const currentUserId = user.value?.id ?? null;

  overviewLoading.value = true;
  overviewError.value = null;
  recentSignals.value = [];
  memberAssignments.value = [];
  memberCompletedAssignments.value = [];
  memberGroups.value = [];
  allNarrations.value = [];
  matchSummaries.value = [];
  orgAssignments.value = [];

  try {
    const mediaPromise = mediaService.listByOrganization(activeOrgId, { limit: 12 });
    const assignmentsPromise = assignmentsService.getAssignmentsForOrg(activeOrgId);
    const groupsPromise = groupsService.getGroupsForOrg(activeOrgId);
    const userAssignmentsPromise = currentUserId
      ? assignmentsService.getAssignmentsForUser(activeOrgId, currentUserId)
      : Promise.resolve({ assignedToYou: [], assignedToTeam: [], assignedToGroups: [] });

    const narrationsPromise = mediaPromise.then(async (mediaAssets) => {
      if (mediaAssets.length === 0) return [] as Narration[];
      const narrationLists = await Promise.all(
        mediaAssets.map((asset) => narrationService.listNarrationsForMediaAsset(asset.id))
      );
      return narrationLists.flat();
    });

    const [mediaAssets, assignments, groups, assignmentFeed, narrations] = await Promise.all([
      mediaPromise,
      assignmentsPromise,
      groupsPromise,
      userAssignmentsPromise,
      narrationsPromise,
    ]);

    if (activeOrgId !== orgId.value) return;

    allNarrations.value = narrations;

    const recentNarrations = [...narrations]
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 12);

    const recentMedia = mediaAssets.slice(0, 8);
    const recentAssignments = assignments.slice(0, 10);
    recentSignals.value = buildRecentSignals(recentNarrations, recentMedia, recentAssignments, lastSeenAt.value);

    const recentMatches = mediaAssets.slice(0, 3);
    const matchSegmentLists = await Promise.all(
      recentMatches.map((asset) => segmentService.listSegmentsForMediaAsset(asset.id))
    );
    const narrationsByAsset = narrations.reduce<Record<string, Narration[]>>((acc, narration) => {
      const id = narration.media_asset_id;
      const list = acc[id] ?? [];
      list.push(narration);
      acc[id] = list;
      return acc;
    }, {});
    matchSummaries.value = recentMatches.map((asset, index) =>
      buildCoverageSummary(asset, matchSegmentLists[index] ?? [], narrationsByAsset[asset.id] ?? [])
    );

    if (currentUserId) {
      memberGroups.value = groups
        .filter((entry) => entry.memberIds.includes(currentUserId))
        .map(toGroupSummary);
    }

    const assignedToYou = assignmentFeed.assignedToYou ?? [];
    completedAssignmentIds.value = assignedToYou
      .filter((assignment) => assignment.completed)
      .map((assignment) => String(assignment.id));

    memberAssignments.value = assignedToYou
      .filter((assignment) => !assignment.completed)
      .slice(0, 5);
    memberCompletedAssignments.value = assignedToYou
      .filter((assignment) => assignment.completed)
      .slice(0, 5);

    orgAssignments.value = assignments;

  } catch (error) {
    overviewError.value = error instanceof Error ? error.message : 'Failed to load command data.';
  } finally {
    if (activeOrgId === orgId.value) {
      overviewLoading.value = false;
    }
  }
};

watch(
  () => [orgId.value, user.value?.id],
  ([nextOrgId]) => {
    if (!nextOrgId) return;
    void loadOverview();
  },
  { immediate: true }
);
</script>

<template>
  <section class="container-lg py-6 pb-50 text-white">
    <div v-if="resolving" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Loading organization…
    </div>

    <div v-else-if="!org" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Organization unavailable.
    </div>

    <div v-else class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <div class="space-y-8">
        <OrgOverviewHeader :org="org" :member-count="memberCount" :can-manage="canManage" />

        <div
          v-if="overviewError"
          class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {{ overviewError }}
        </div>

        <div v-if="canManage" class="space-y-6">
          <section class="rounded-lg border border-white/10 bg-white/5 p-5">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-[10px] uppercase tracking-[0.3em] text-white/40">This Week’s Matches</p>
                <h2 class="text-base font-semibold text-white/90">Review coverage at a glance</h2>
              </div>
              <span class="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
                Last 3
              </span>
            </div>

            <div v-if="overviewLoading" class="mt-4 text-sm text-white/60">
              Loading recent matches…
            </div>
            <div v-else-if="matchSummaries.length === 0" class="mt-4 text-sm text-white/60">
              No recent matches yet. Upload footage to start the weekly brief.
            </div>
            <div v-else class="mt-4 grid gap-4 sm:flex sm:gap-4 sm:overflow-x-auto sm:pb-2 sm:snap-x sm:snap-mandatory">
              <RouterLink
                v-for="match in matchSummaries"
                :key="match.id"
                :to="match.to"
                class="group w-full sm:min-w-[240px] sm:max-w-[280px] sm:snap-start rounded-lg border border-white/10 bg-white/5 p-3 transition hover:border-white/30 hover:bg-white/10"
              >
                <div class="relative w-full overflow-hidden rounded-md bg-white/5">
                  <div class="relative w-full pb-[56.25%]">
                    <img
                      v-if="match.thumbnailUrl"
                      :src="match.thumbnailUrl"
                      :alt="match.title"
                      loading="lazy"
                      class="absolute inset-0 h-full w-full object-cover"
                    />
                    <div v-else class="absolute inset-0 flex items-center justify-center text-xs text-white/40">
                      No thumbnail
                    </div>
                    <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                    <div
                      class="absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
                      :class="match.coverageState === 'covered'
                        ? 'bg-emerald-500/80 text-white'
                        : match.coverageState === 'partial'
                          ? 'bg-amber-400/80 text-black'
                          : 'bg-red-500/80 text-white'"
                    >
                      {{ match.coverageState === 'covered' ? 'Covered' : match.coverageState === 'partial' ? 'Partial' : 'Needs review' }}
                    </div>
                  </div>
                </div>

                <div class="mt-3 flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-white/90 line-clamp-1">
                      {{ match.title }}
                    </div>
                    <div class="mt-1 space-y-1 text-xs text-white/50">
                      <div>{{ match.dateLabel }}</div>
                      <div>{{ match.narratedSegments }} review moments captured</div>
                      <div class="text-white/40 italic">
                        <span v-if="match.coverageState === 'needs_review' && match.narratedSegments === 0">
                          Review not started
                        </span>
                        <span v-else-if="match.coverageState === 'partial'">
                          Review in progress
                        </span>
                        <span v-else-if="match.coverageState === 'covered'">Match fully reviewed</span>
                      </div>
                      <div v-if="match.coverageState !== 'covered'" class="text-white/40 italic">
                        More analysis recommended
                      </div>
                    </div>
                  </div>
                </div>
              </RouterLink>
            </div>
          </section>

          <section class="rounded-lg border border-white/10 bg-white/5 p-5">
            <div>
              <p class="text-[10px] uppercase tracking-[0.3em] text-white/40">Review Signals</p>
              <h2 class="text-base font-semibold text-white/90">What needs attention</h2>
            </div>
            <div v-if="overviewLoading" class="mt-3 text-sm text-white/60">
              Scanning for signals…
            </div>
            <ul v-else-if="reviewSignals.length" class="mt-3 space-y-2 text-sm text-white/80">
              <li v-for="(signal, index) in reviewSignals" :key="index" class="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                {{ signal }}
              </li>
            </ul>
            <p v-else class="mt-3 text-sm text-white/60">All quiet here.</p>
          </section>

          <section class="rounded-lg border border-white/10 bg-white/5 p-5">
            <div>
              <p class="text-[10px] uppercase tracking-[0.3em] text-white/40">Assignments</p>
              <h2 class="text-base font-semibold text-white/90">Downstream follow-ups</h2>
            </div>
            <div v-if="overviewLoading" class="mt-3 text-sm text-white/60">
              Loading assignments…
            </div>
            <div v-else class="mt-3 space-y-4">
              <div v-if="overdueAssignments.length === 0 && recentCompletedAssignments.length === 0" class="text-sm text-white/60">
                Assignments are up to date.
              </div>

              <div v-if="overdueAssignments.length" class="space-y-2">
                <p class="text-xs uppercase tracking-[0.2em] text-white/50">Overdue</p>
                <RouterLink
                  v-for="assignment in overdueAssignments"
                  :key="assignment.id"
                  :to="{ name: 'OrgAssignments', params: orgRouteParams, query: { assignmentId: assignment.id } }"
                  class="block rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  <div class="font-medium text-white/90 line-clamp-1">{{ assignment.title }}</div>
                  <div class="text-xs text-white/50">{{ formatDueStatus(assignment.due_at) }}</div>
                </RouterLink>
              </div>

              <div v-if="recentCompletedAssignments.length" class="space-y-2">
                <p class="text-xs uppercase tracking-[0.2em] text-white/50">Recently completed</p>
                <RouterLink
                  v-for="assignment in recentCompletedAssignments"
                  :key="assignment.id"
                  :to="{ name: 'OrgFeed', params: orgRouteParams }"
                  class="block rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  <div class="font-medium text-white/90 line-clamp-1">{{ assignment.title }}</div>
                  <div class="text-xs text-white/50">Completed {{ formatRelative(assignment.completed_at ?? null) }}</div>
                </RouterLink>
              </div>
            </div>
          </section>
        </div>

        <div v-else class="space-y-6">
          <section class="rounded-lg border border-white/10 bg-white/5 p-5">
            <div>
              <p class="text-[10px] uppercase tracking-[0.3em] text-white/40">Your Week</p>
              <h2 class="text-base font-semibold text-white/90">Assignments to watch or complete</h2>
            </div>
            <div v-if="overviewLoading" class="mt-3 text-sm text-white/60">
              Loading your assignments…
            </div>
            <div v-else-if="memberAssignments.length === 0" class="mt-3 text-sm text-white/60">
              You are clear this week. Check back when new assignments land.
            </div>
            <div v-else class="mt-3 space-y-2">
              <RouterLink
                v-for="assignment in memberAssignments"
                :key="assignment.id"
                :to="{ name: 'OrgFeed', params: orgRouteParams }"
                class="block rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                <div class="font-medium text-white/90 line-clamp-1">{{ assignment.title }}</div>
                <div class="text-xs text-white/50">{{ formatDueStatus(assignment.due_at) }}</div>
              </RouterLink>
            </div>
          </section>

          <section class="rounded-lg border border-white/10 bg-white/5 p-5">
            <div>
              <p class="text-[10px] uppercase tracking-[0.3em] text-white/40">Your Squads</p>
              <h2 class="text-base font-semibold text-white/90">Groups you’re preparing with</h2>
            </div>
            <div v-if="overviewLoading" class="mt-3 text-sm text-white/60">
              Loading squads…
            </div>
            <div v-else-if="memberGroups.length === 0" class="mt-3 text-sm text-white/60">
              You are not assigned to a squad yet.
            </div>
            <div v-else class="mt-3 space-y-2">
              <div
                v-for="group in memberGroups"
                :key="group.id"
                class="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80"
              >
                <div class="font-medium text-white/90 line-clamp-1">{{ group.name }}</div>
                <div class="text-xs text-white/50">{{ group.memberCount }} members · Joined {{ formatRelative(group.createdAt) }}</div>
              </div>
            </div>
          </section>
        </div>

      </div>

      <aside class="lg:pt-2">
        <div class="space-y-6">
          <OrgOverviewActivityList :items="recentSignals" :is-loading="overviewLoading" />
          <OrgOverviewQuickActions v-if="canManage" :actions="quickActions" />
        </div>
      </aside>
    </div>
  </section>
</template>

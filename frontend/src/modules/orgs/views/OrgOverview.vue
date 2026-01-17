<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import { formatDaysAgo } from '@/lib/date';
import { useActiveOrganizationStore } from '../stores/useActiveOrganizationStore';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { assignmentsService } from '@/modules/assignments/services/assignmentsService';
import { groupsService } from '@/modules/groups/services/groupsService';
import { mediaService } from '@/modules/media/services/mediaService';
import { narrationService } from '@/modules/narrations/services/narrationService';
import type { FeedAssignment, OrgAssignmentListItem } from '@/modules/assignments/types/Assignment';
import type { Narration } from '@/modules/narrations/types/Narration';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import OrgOverviewHeader from '@/modules/orgs/components/OrgOverviewHeader.vue';
import OrgOverviewActivityList from '@/modules/orgs/components/OrgOverviewActivityList.vue';
import OrgOverviewSignalSection from '@/modules/orgs/components/OrgOverviewYourWorld.vue';
import OrgOverviewQuickActions from '@/modules/orgs/components/OrgOverviewQuickActions.vue';

type RecentSignalItem = {
  id: string;
  label: string;
  timeLabel: string;
  typeLabel: string;
  icon: string;
  to: RouteLocationRaw;
};

type SignalItem = {
  id: string;
  title: string;
  meta?: string;
  status?: string;
  tag?: string;
  to?: RouteLocationRaw;
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
const isMemberRole = computed(() => role.value === 'member');

const overviewLoading = ref(false);
const overviewError = ref<string | null>(null);

const recentSignals = ref<RecentSignalItem[]>([]);
const lastSeenAt = ref<Date | null>(null);

const memberAssignments = ref<FeedAssignment[]>([]);
const memberGroups = ref<GroupSummary[]>([]);
const createdAssignments = ref<OrgAssignmentListItem[]>([]);
const managedGroups = ref<GroupSummary[]>([]);
const orgAssignments = ref<OrgAssignmentListItem[]>([]);

const formatPreview = (value: string, maxLength = 120) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
};

const formatRelative = (value: string | Date | null | undefined) => formatDaysAgo(value) ?? 'date unknown';

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

const needsCommandAttention = (assignment: OrgAssignmentListItem, currentUserId: string | null) => {
  const urgency = getAssignmentUrgency(assignment.due_at);
  if (urgency === 'overdue' || urgency === 'due_soon') return true;
  return assignment.created_by === currentUserId && urgency === 'undated';
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

const toGroupSignalItem = (group: GroupSummary, routeName?: string): SignalItem => ({
  id: group.id,
  title: group.name,
  meta: `${group.memberCount} members - Created ${formatRelative(group.createdAt)}`,
  tag: 'Group',
  to: routeName ? { name: routeName, params: orgRouteParams.value } : undefined,
});

const toMemberAssignmentItem = (assignment: FeedAssignment): SignalItem => ({
  id: assignment.id,
  title: assignment.title,
  meta: formatDueStatus(assignment.due_at),
  status: assignment.completed ? 'Done' : 'Open',
  tag: 'Assignment',
  to: { name: 'OrgFeed', params: orgRouteParams.value },
});

const toCommandAssignmentItem = (assignment: OrgAssignmentListItem, currentUserId: string | null): SignalItem => {
  const urgency = getAssignmentUrgency(assignment.due_at);
  const status = urgency === 'overdue'
    ? 'Overdue'
    : urgency === 'due_soon'
      ? 'Due soon'
      : assignment.created_by === currentUserId
        ? 'Owned'
        : 'Pending';

  return {
    id: assignment.id,
    title: assignment.title,
    meta: formatDueStatus(assignment.due_at),
    status,
    tag: 'Assignment',
    to: { name: 'OrgAssignments', params: orgRouteParams.value, query: { assignmentId: assignment.id } },
  };
};

const toCreatedAssignmentItem = (assignment: OrgAssignmentListItem): SignalItem => ({
  id: assignment.id,
  title: assignment.title,
  meta: formatDueStatus(assignment.due_at),
  status: 'Created',
  tag: 'Assignment',
  to: { name: 'OrgAssignments', params: orgRouteParams.value, query: { assignmentId: assignment.id } },
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

const uniqueSignalItems = (items: SignalItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.tag ?? 'item'}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const commandAttentionAssignments = computed(() => {
  if (!canManage.value) return [] as OrgAssignmentListItem[];
  const currentUserId = user.value?.id ?? null;
  return orgAssignments.value.filter((assignment) => needsCommandAttention(assignment, currentUserId));
});

const commandSignalItems = computed<SignalItem[]>(() => {
  if (!canManage.value) return [];
  const currentUserId = user.value?.id ?? null;
  return commandAttentionAssignments.value.map((assignment) => toCommandAssignmentItem(assignment, currentUserId));
});

const hasCommandSignals = computed(() => commandSignalItems.value.length > 0);

const oversightItems = computed<SignalItem[]>(() => {
  const currentUserId = user.value?.id ?? null;
  const attentionItems = commandAttentionAssignments.value.map((assignment) =>
    toCommandAssignmentItem(assignment, currentUserId)
  );
  const ownedItems = createdAssignments.value.map(toCreatedAssignmentItem);
  const groupItems = managedGroups.value.map((group) => toGroupSignalItem(group, 'OrgGroups'));

  return uniqueSignalItems([...attentionItems, ...ownedItems, ...groupItems]).slice(0, 8);
});

const memberFocusItems = computed<SignalItem[]>(() =>
  uniqueSignalItems([
    ...memberAssignments.value.map(toMemberAssignmentItem),
    ...memberGroups.value.map((group) => toGroupSignalItem(group)),
  ]).slice(0, 8)
);

const focusItems = computed<SignalItem[]>(() => (isMemberRole.value ? memberFocusItems.value : oversightItems.value));
const focusTitle = computed(() => (isMemberRole.value ? 'Your Focus' : 'Your Oversight'));
const focusDescription = computed(() =>
  isMemberRole.value
    ? 'Assignments and squads you can act on next.'
    : 'Responsibilities that need steering, review, or a decision.'
);
const focusEmptyLabel = computed(() =>
  isMemberRole.value
    ? 'You are clear for now. Check back when new assignments land.'
    : 'All clear. Nothing needs your attention right now.'
);
const focusVariant = computed(() => (isMemberRole.value ? 'personal' : 'command'));

const getManagedGroups = (
  groups: Array<{ group: { id: string; name: string; created_at: string }; memberIds: string[] }>,
  userId: string
) => {
  // TODO: Replace membership proxy with explicit group leadership data.
  return groups.filter((entry) => entry.memberIds.includes(userId));
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
  memberGroups.value = [];
  createdAssignments.value = [];
  managedGroups.value = [];
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

    const recentNarrations = [...narrations]
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 12);

    const recentMedia = mediaAssets.slice(0, 8);
    const recentAssignments = assignments.slice(0, 10);
    recentSignals.value = buildRecentSignals(recentNarrations, recentMedia, recentAssignments, lastSeenAt.value);

    if (currentUserId) {
      memberGroups.value = groups
        .filter((entry) => entry.memberIds.includes(currentUserId))
        .map(toGroupSummary);
      managedGroups.value = getManagedGroups(groups, currentUserId).map(toGroupSummary);
    }

    memberAssignments.value = assignmentFeed.assignedToYou.filter((assignment) => !assignment.completed).slice(0, 5);

    orgAssignments.value = assignments;

    createdAssignments.value = assignments
      .filter((assignment) => assignment.created_by === currentUserId)
      .slice(0, 5);

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
  <section class="container-lg py-6 text-white">
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

        <div
          v-if="canManage"
          class="rounded-lg border border-white/10 bg-white/5 p-4 text-white/80"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-[10px] uppercase tracking-[0.3em] text-white/40">Command signals</p>
              <h2 class="text-sm font-semibold text-white/90">Attention check</h2>
            </div>
            <span
              v-if="hasCommandSignals"
              class="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-200"
            >
              Needs review
            </span>
          </div>
          <p v-if="hasCommandSignals" class="mt-2 text-sm text-white/80">
            {{ commandSignalItems.length }} item{{ commandSignalItems.length === 1 ? '' : 's' }} need attention.
            Review overdue or due-soon assignments.
          </p>
          <p v-else class="mt-2 text-sm text-white/60">All clear.</p>
        </div>

        <OrgOverviewSignalSection
          eyebrow="What should I focus on right now?"
          :title="focusTitle"
          :description="focusDescription"
          :variant="focusVariant"
          :items="focusItems"
          :is-loading="overviewLoading"
          :empty-label="focusEmptyLabel"
        />

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

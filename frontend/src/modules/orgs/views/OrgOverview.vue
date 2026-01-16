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

const memberAssignments = ref<FeedAssignment[]>([]);
const memberGroups = ref<GroupSummary[]>([]);
const createdAssignments = ref<OrgAssignmentListItem[]>([]);
const managedGroups = ref<GroupSummary[]>([]);
const commandAssignments = ref<OrgAssignmentListItem[]>([]);
const commandGroups = ref<GroupSummary[]>([]);

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

const toOwnedAssignmentItem = (assignment: OrgAssignmentListItem, currentUserId: string | null): SignalItem => ({
  id: assignment.id,
  title: assignment.title,
  meta: formatDueStatus(assignment.due_at),
  status: assignment.created_by === currentUserId ? 'Owned' : 'Pending',
  tag: 'Assignment',
  to: { name: 'OrgAssignments', params: orgRouteParams.value },
});

const toCreatedAssignmentItem = (assignment: OrgAssignmentListItem): SignalItem => ({
  id: assignment.id,
  title: assignment.title,
  meta: formatDueStatus(assignment.due_at),
  status: 'Created',
  tag: 'Assignment',
  to: { name: 'OrgAssignments', params: orgRouteParams.value },
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

const commandSignals = computed<SignalItem[]>(() => {
  if (!canManage.value) return [];
  const currentUserId = user.value?.id ?? null;
  return [
    ...commandAssignments.value.map((assignment) => toOwnedAssignmentItem(assignment, currentUserId)),
    ...commandGroups.value.map((group) => toGroupSignalItem(group, 'OrgGroups')),
  ];
});

const yourWorldTitle = computed(() => (isMemberRole.value ? 'Your Focus' : 'Your Oversight'));
const yourWorldDescription = computed(() =>
  isMemberRole.value
    ? 'Assignments and squads tied directly to you.'
    : 'Assignments and groups you are steering.'
);
const yourWorldItems = computed<SignalItem[]>(() => {
  if (isMemberRole.value) {
    return [
      ...memberAssignments.value.map(toMemberAssignmentItem),
      ...memberGroups.value.map((group) => toGroupSignalItem(group)),
    ];
  }
  return [
    ...createdAssignments.value.map(toCreatedAssignmentItem),
    ...managedGroups.value.map((group) => toGroupSignalItem(group, 'OrgGroups')),
  ];
});

const yourWorldEmptyLabel = computed(() =>
  isMemberRole.value ? 'No focus items right now.' : 'No oversight items right now.'
);

const isPendingAssignment = (assignment: OrgAssignmentListItem) => {
  if (!assignment.due_at) return true;
  const dueDate = new Date(assignment.due_at);
  if (Number.isNaN(dueDate.getTime())) return true;
  return dueDate.getTime() >= Date.now();
};

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
  assignments: OrgAssignmentListItem[]
): RecentSignalItem[] => {
  const assignmentRouteName = canManage.value ? 'OrgAssignments' : 'OrgFeed';
  const items: Array<{ sortKey: number; item: RecentSignalItem }> = [];

  for (const narration of narrations) {
    const content = narration.transcript_clean ?? narration.transcript_raw ?? '';
    const label = formatPreview(content, 110) || 'Narration added';
    items.push({
      sortKey: toTimestamp(narration.created_at),
      item: {
        id: narration.id,
        label,
        timeLabel: formatRelative(narration.created_at),
        typeLabel: 'Narration',
        icon: 'carbon:microphone',
        to: {
          name: 'MediaAssetSegment',
          params: { ...orgRouteParams.value, segmentId: narration.media_asset_segment_id },
        },
      },
    });
  }

  for (const asset of mediaAssets) {
    const label = (asset.title ?? asset.file_name).trim() || 'Media upload';
    items.push({
      sortKey: toTimestamp(asset.created_at),
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

  for (const assignment of assignments) {
    items.push({
      sortKey: toTimestamp(assignment.created_at),
      item: {
        id: assignment.id,
        label: assignment.title,
        timeLabel: formatRelative(assignment.created_at),
        typeLabel: 'Assignment',
        icon: 'carbon:task',
        to: {
          name: assignmentRouteName,
          params: orgRouteParams.value,
        },
      },
    });
  }

  return items
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 12)
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
  commandAssignments.value = [];
  commandGroups.value = [];

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
      .slice(0, 5);

    const recentMedia = mediaAssets.slice(0, 5);
    const recentAssignments = assignments.slice(0, 5);
    recentSignals.value = buildRecentSignals(recentNarrations, recentMedia, recentAssignments);

    const groupSummaries = groups.map(toGroupSummary);
    if (currentUserId) {
      memberGroups.value = groups
        .filter((entry) => entry.memberIds.includes(currentUserId))
        .map(toGroupSummary);
      managedGroups.value = getManagedGroups(groups, currentUserId).map(toGroupSummary);
    }

    commandGroups.value = [...groupSummaries]
      // TODO: replace created_at sorting with actual group activity signal when available.
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 5);

    memberAssignments.value = assignmentFeed.assignedToYou.filter((assignment) => !assignment.completed).slice(0, 5);

    createdAssignments.value = assignments
      .filter((assignment) => assignment.created_by === currentUserId)
      .slice(0, 5);

    commandAssignments.value = assignments
      .filter((assignment) => assignment.created_by === currentUserId || isPendingAssignment(assignment))
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

    <div v-else class="space-y-8">
      <OrgOverviewHeader :org="org" :member-count="memberCount" :can-manage="canManage" />

      <div
        v-if="overviewError"
        class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
      >
        {{ overviewError }}
      </div>

      <OrgOverviewQuickActions v-if="canManage" :actions="quickActions" />

      <OrgOverviewActivityList :items="recentSignals" :is-loading="overviewLoading" />

      <OrgOverviewSignalSection
        v-if="canManage"
        eyebrow="What needs attention"
        title="Command Signals"
        description="Priority items that need your attention."
        variant="command"
        :items="commandSignals"
        :is-loading="overviewLoading"
        empty-label="No command signals right now."
      />

      <OrgOverviewSignalSection
        eyebrow="What do I need to do"
        :title="yourWorldTitle"
        :description="yourWorldDescription"
        variant="personal"
        :items="yourWorldItems"
        :is-loading="overviewLoading"
        :empty-label="yourWorldEmptyLabel"
      />
    </div>
  </section>
</template>

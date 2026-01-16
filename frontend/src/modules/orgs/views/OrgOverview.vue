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
import OrgOverviewYourWorld from '@/modules/orgs/components/OrgOverviewYourWorld.vue';
import OrgOverviewQuickActions from '@/modules/orgs/components/OrgOverviewQuickActions.vue';

type ActivityItem = {
  id: string;
  title: string;
  meta?: string;
};

type OverviewItem = {
  id: string;
  title: string;
  meta?: string;
  status?: string;
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
  to: RouteLocationRaw;
};

const authStore = useAuthStore();
const { user } = storeToRefs(authStore);

const activeOrganizationStore = useActiveOrganizationStore();
const { orgContext, resolving, memberCount } = storeToRefs(activeOrganizationStore);

const org = computed(() => orgContext.value?.organization ?? null);
const orgId = computed(() => org.value?.id ?? null);
const orgSlug = computed(() => org.value?.slug ?? null);

const role = computed(() => orgContext.value?.membership?.role ?? null);
const canManage = computed(() => {
  if (authStore.isAdmin) return true;
  return role.value === 'owner' || role.value === 'manager' || role.value === 'staff';
});
const isMemberRole = computed(() => role.value === 'member');

const overviewLoading = ref(false);
const overviewError = ref<string | null>(null);

const activityNarrations = ref<ActivityItem[]>([]);
const activityMediaUploads = ref<ActivityItem[]>([]);
const activityAssignments = ref<ActivityItem[]>([]);

const memberAssignments = ref<FeedAssignment[]>([]);
const memberGroups = ref<GroupSummary[]>([]);
const managerAssignments = ref<OrgAssignmentListItem[]>([]);
const managerGroups = ref<GroupSummary[]>([]);

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

const formatNarrationSource = (source: Narration['source_type']) => {
  if (source === 'coach') return 'Coach';
  if (source === 'staff') return 'Staff';
  if (source === 'member') return 'Member';
  if (source === 'ai') return 'System';
  return 'Member';
};

const toNarrationActivity = (narration: Narration): ActivityItem => {
  const content = narration.transcript_clean ?? narration.transcript_raw ?? '';
  const title = formatPreview(content, 110) || 'Narration added';
  const meta = `${formatNarrationSource(narration.source_type)} - ${formatRelative(narration.created_at)}`;
  return { id: narration.id, title, meta };
};

const toMediaActivity = (asset: OrgMediaAsset): ActivityItem => {
  const title = (asset.title ?? asset.file_name).trim() || 'Media upload';
  const meta = `${formatRelative(asset.created_at)} - ${asset.kind}`;
  return { id: asset.id, title, meta };
};

const toAssignmentActivity = (assignment: OrgAssignmentListItem): ActivityItem => {
  const clipCount = assignment.clipCount ? `${assignment.clipCount} clips` : 'No clips';
  const meta = `${formatDueStatus(assignment.due_at)} - ${clipCount}`;
  return { id: assignment.id, title: assignment.title, meta };
};

const toGroupSummary = (entry: { group: { id: string; name: string; created_at: string }; memberIds: string[] }): GroupSummary => ({
  id: entry.group.id,
  name: entry.group.name,
  memberCount: entry.memberIds.length,
  createdAt: entry.group.created_at ?? null,
});

const toGroupItem = (group: GroupSummary): OverviewItem => {
  const meta = `${group.memberCount} members - ${formatRelative(group.createdAt)}`;
  return { id: group.id, title: group.name, meta };
};

const toMemberAssignmentItem = (assignment: FeedAssignment): OverviewItem => ({
  id: assignment.id,
  title: assignment.title,
  meta: formatDueStatus(assignment.due_at),
  status: assignment.completed ? 'Done' : 'Open',
});

const toManagerAssignmentItem = (assignment: OrgAssignmentListItem, currentUserId: string | null): OverviewItem => {
  const status = assignment.created_by === currentUserId ? 'Created' : 'Pending';
  const meta = `${formatDueStatus(assignment.due_at)} - Created ${formatRelative(assignment.created_at)}`;
  return { id: assignment.id, title: assignment.title, meta, status };
};

const quickActions = computed<QuickAction[]>(() => {
  if (!orgSlug.value) return [];
  return [
    {
      id: 'upload-media',
      label: 'Upload Media',
      description: 'Send new footage to the org vault.',
      to: { name: 'OrgMedia', params: { slug: orgSlug.value } },
    },
    {
      id: 'create-assignment',
      label: 'Create Assignment',
      description: 'Define review clips and due dates.',
      to: { name: 'OrgAssignments', params: { slug: orgSlug.value } },
    },
    {
      id: 'create-group',
      label: 'Create Group',
      description: 'Segment members into focused squads.',
      to: { name: 'OrgGroups', params: { slug: orgSlug.value } },
    },
    {
      id: 'invite-member',
      label: 'Invite Member',
      description: 'Add new staff or players.',
      to: { name: 'OrgMembers', params: { slug: orgSlug.value } },
    },
  ];
});

const yourWorldTitle = computed(() => (isMemberRole.value ? 'Your World' : 'Command Signals'));
const yourWorldDescription = computed(() =>
  isMemberRole.value
    ? 'Assignments and groups scoped to you.'
    : 'Operational items that need your oversight.'
);
const yourWorldAssignmentsTitle = computed(() =>
  isMemberRole.value ? 'Assignments assigned to you' : 'Assignments you own or pending'
);
const yourWorldGroupsTitle = computed(() =>
  isMemberRole.value ? 'Groups you belong to' : 'Groups with recent activity'
);

const yourWorldAssignments = computed<OverviewItem[]>(() => {
  const currentUserId = user.value?.id ?? null;
  if (isMemberRole.value) {
    return memberAssignments.value.map(toMemberAssignmentItem);
  }
  return managerAssignments.value.map((assignment) => toManagerAssignmentItem(assignment, currentUserId));
});

const yourWorldGroups = computed<OverviewItem[]>(() => {
  return isMemberRole.value ? memberGroups.value.map(toGroupItem) : managerGroups.value.map(toGroupItem);
});

const layoutClass = computed(() =>
  canManage.value ? 'grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : 'space-y-6'
);

const isPendingAssignment = (assignment: OrgAssignmentListItem) => {
  if (!assignment.due_at) return true;
  const dueDate = new Date(assignment.due_at);
  if (Number.isNaN(dueDate.getTime())) return true;
  return dueDate.getTime() >= Date.now();
};

const loadOverview = async () => {
  if (!orgId.value) return;
  const activeOrgId = orgId.value;
  const currentUserId = user.value?.id ?? null;

  overviewLoading.value = true;
  overviewError.value = null;
  activityNarrations.value = [];
  activityMediaUploads.value = [];
  activityAssignments.value = [];
  memberAssignments.value = [];
  memberGroups.value = [];
  managerAssignments.value = [];
  managerGroups.value = [];

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

    activityNarrations.value = recentNarrations.map(toNarrationActivity);
    activityMediaUploads.value = mediaAssets.slice(0, 5).map(toMediaActivity);
    activityAssignments.value = assignments.slice(0, 5).map(toAssignmentActivity);

    const groupSummaries = groups.map(toGroupSummary);
    if (currentUserId) {
      memberGroups.value = groups
        .filter((entry) => entry.memberIds.includes(currentUserId))
        .map(toGroupSummary);
    }

    managerGroups.value = [...groupSummaries]
      // TODO: replace created_at sorting with actual group activity signal when available.
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 5);

    memberAssignments.value = assignmentFeed.assignedToYou.filter((assignment) => !assignment.completed).slice(0, 5);

    managerAssignments.value = assignments
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
  <section class="container-lg pt-6 text-white">
    <div v-if="resolving" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Loading organization…
    </div>

    <div v-else-if="!org" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Organization unavailable.
    </div>

    <div v-else class="space-y-6">
      <OrgOverviewHeader :org="org" :member-count="memberCount" :can-manage="canManage" />

      <div
        v-if="overviewError"
        class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
      >
        {{ overviewError }}
      </div>

      <div :class="layoutClass">
        <div class="space-y-6">
          <OrgOverviewActivityList
            :narrations="activityNarrations"
            :media-uploads="activityMediaUploads"
            :assignments="activityAssignments"
            :is-loading="overviewLoading"
          />

          <OrgOverviewYourWorld
            :title="yourWorldTitle"
            :description="yourWorldDescription"
            :assignments-title="yourWorldAssignmentsTitle"
            :groups-title="yourWorldGroupsTitle"
            :assignments="yourWorldAssignments"
            :groups="yourWorldGroups"
            :is-loading="overviewLoading"
          />
        </div>

        <OrgOverviewQuickActions v-if="canManage" :actions="quickActions" />
      </div>
    </div>
  </section>
</template>

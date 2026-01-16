<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { orgService } from '@/modules/orgs/services/orgServiceV2';
import type { OrgMember } from '@/modules/orgs/types';

import { groupsService } from '@/modules/groups/services/groupsService';
import type { OrgGroup } from '@/modules/groups/types';

import {
  assignmentsService,
  type AssignmentProgressRow,
  type AssignmentTargetInput,
} from '@/modules/assignments/services/assignmentsService';
import type { AssignmentTargetType, OrgAssignmentListItem, OrgAssignmentTarget } from '@/modules/assignments/types';
import CreateAssignmentModal from '@/modules/assignments/components/CreateAssignmentModal.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const orgId = computed(() => orgContext.value?.organization.id ?? null);
const orgSlug = computed(() => String(route.params.slug ?? ''));
const canManage = computed(() => {
  if (authStore.isAdmin) return true;
  const role = orgContext.value?.membership?.role;
  return role === 'owner' || role === 'manager' || role === 'staff';
});

const loading = ref(false);
const error = ref<string | null>(null);

const members = ref<OrgMember[]>([]);
const groups = ref<Array<{ group: OrgGroup; memberIds: string[] }>>([]);
const assignments = ref<OrgAssignmentListItem[]>([]);
const progressRows = ref<AssignmentProgressRow[]>([]);
const editingAssignment = ref<OrgAssignmentListItem | null>(null);

const statusFilter = ref<'all' | 'overdue' | 'due_soon' | 'completed'>('all');
const targetFilter = ref<'all' | 'team' | 'group' | 'player'>('all');
const groupFilter = ref('all');
const playerFilter = ref('all');
const assignmentIdFilter = ref('');

const statusFilterOptions = new Set(['all', 'overdue', 'due_soon', 'completed']);
const targetFilterOptions = new Set(['all', 'team', 'group', 'player']);
const isSyncingFilters = ref(false);

const getQueryValue = (value: unknown): string | null => {
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : null;
  if (typeof value === 'string') return value;
  if (value == null) return null;
  return String(value);
};

const isFilterQueryInSync = () => {
  const queryStatus = getQueryValue(route.query.status);
  const queryTarget = getQueryValue(route.query.target);
  const queryGroup = getQueryValue(route.query.group);
  const queryPlayer = getQueryValue(route.query.player);
  const queryAssignmentId = getQueryValue(route.query.assignmentId);

  const statusMatches = statusFilter.value === 'all'
    ? queryStatus == null
    : queryStatus === statusFilter.value;
  const targetMatches = targetFilter.value === 'all'
    ? queryTarget == null
    : queryTarget === targetFilter.value;
  const groupMatches = groupFilter.value === 'all'
    ? queryGroup == null
    : queryGroup === groupFilter.value;
  const playerMatches = playerFilter.value === 'all'
    ? queryPlayer == null
    : queryPlayer === playerFilter.value;
  const assignmentMatches = assignmentIdFilter.value
    ? queryAssignmentId === assignmentIdFilter.value
    : queryAssignmentId == null;

  return statusMatches && targetMatches && groupMatches && playerMatches && assignmentMatches;
};

const syncFiltersFromQuery = () => {
  isSyncingFilters.value = true;
  try {
  const nextAssignmentId = getQueryValue(route.query.assignmentId) ?? '';
  assignmentIdFilter.value = nextAssignmentId;
  if (nextAssignmentId) {
    statusFilter.value = 'all';
    targetFilter.value = 'all';
    groupFilter.value = 'all';
    playerFilter.value = 'all';
    return;
  }
  const nextStatus = getQueryValue(route.query.status);
  statusFilter.value = nextStatus && statusFilterOptions.has(nextStatus) ? nextStatus : 'all';

  const nextTarget = getQueryValue(route.query.target);
  targetFilter.value = nextTarget && targetFilterOptions.has(nextTarget) ? nextTarget : 'all';

  const nextGroup = getQueryValue(route.query.group);
  groupFilter.value = nextGroup ?? 'all';

  const nextPlayer = getQueryValue(route.query.player);
  playerFilter.value = nextPlayer ?? 'all';
  } finally {
    isSyncingFilters.value = false;
  }
};

const syncQueryFromFilters = () => {
  if (isFilterQueryInSync()) return;

  const nextQuery: Record<string, unknown> = { ...route.query };
  delete nextQuery.status;
  delete nextQuery.target;
  delete nextQuery.group;
  delete nextQuery.player;
  delete nextQuery.assignmentId;

  if (statusFilter.value !== 'all') nextQuery.status = statusFilter.value;
  if (targetFilter.value !== 'all') nextQuery.target = targetFilter.value;
  if (groupFilter.value !== 'all') nextQuery.group = groupFilter.value;
  if (playerFilter.value !== 'all') nextQuery.player = playerFilter.value;
  if (assignmentIdFilter.value) nextQuery.assignmentId = assignmentIdFilter.value;

  void router.replace({ query: nextQuery });
};

async function load() {
  if (!orgId.value) return;

  loading.value = true;
  error.value = null;

  try {
    const [memberRows, groupRows, assignmentRows] = await Promise.all([
      orgService.listMembers(orgId.value),
      groupsService.getGroupsForOrg(orgId.value),
      assignmentsService.getAssignmentsForOrg(orgId.value),
    ]);

    members.value = memberRows;
    groups.value = groupRows;
    assignments.value = assignmentRows;

    progressRows.value = assignmentRows.length > 0
      ? await assignmentsService.getAssignmentProgress(assignmentRows.map((a) => a.id))
      : [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load assignments.';
    assignments.value = [];
    progressRows.value = [];
  } finally {
    loading.value = false;
  }
}

function formatDue(value: Date | null): string {
  if (!value) return '';
  return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString();
}

function clipLabel(count: number): string {
  return count === 1 ? '1 clip' : `${count} clips`;
}

const memberNameById = computed(() => {
  const map = new Map<string, string>();
  for (const member of members.value) {
    const name = member.profile.name || member.profile.username || 'Player';
    map.set(member.profile.id, name);
  }
  return map;
});

const groupById = computed(() => {
  return new Map(groups.value.map((g) => [g.group.id, g]));
});

const assignmentById = computed(() => {
  return new Map(assignments.value.map((assignment) => [assignment.id, assignment]));
});

const completedByAssignment = computed(() => {
  const map = new Map<string, Set<string>>();
  for (const row of progressRows.value) {
    if (!row.completed) continue;
    const set = map.get(row.assignment_id) ?? new Set<string>();
    set.add(row.profile_id);
    map.set(row.assignment_id, set);
  }
  return map;
});

function assignmentTargetLabels(item: OrgAssignmentListItem): string[] {
  const labels: string[] = [];
  const memberNames = memberNameById.value;
  const groupsById = groupById.value;

  for (const target of item.targets ?? []) {
    if (target.target_type === 'team') {
      labels.push('Team');
    } else if (target.target_type === 'player') {
      const name = memberNames.get(String(target.target_id ?? ''));
      labels.push(name || 'Player');
    } else if (target.target_type === 'group') {
      const group = groupsById.get(String(target.target_id ?? ''));
      labels.push(group?.group.name || 'Group');
    }
  }

  return Array.from(new Set(labels)).filter(Boolean);
}

function assignmentAssignees(item: OrgAssignmentListItem): Set<string> {
  const ids = new Set<string>();
  const memberIds = members.value.map((m) => m.profile.id);
  const groupsById = groupById.value;

  for (const target of item.targets ?? []) {
    if (target.target_type === 'team') {
      for (const id of memberIds) ids.add(id);
    }
    if (target.target_type === 'player' && target.target_id) {
      ids.add(String(target.target_id));
    }
    if (target.target_type === 'group' && target.target_id) {
      const group = groupsById.get(String(target.target_id));
      for (const id of group?.memberIds ?? []) ids.add(id);
    }
  }

  return ids;
}

function assignmentTargetTypes(item: OrgAssignmentListItem): Set<string> {
  const types = new Set<string>();
  for (const target of item.targets ?? []) {
    types.add(target.target_type);
  }
  return types;
}

function assignmentTargetGroupIds(item: OrgAssignmentListItem): Set<string> {
  const ids = new Set<string>();
  for (const target of item.targets ?? []) {
    if (target.target_type === 'group' && target.target_id) {
      ids.add(String(target.target_id));
    }
  }
  return ids;
}

function primaryTarget(item: OrgAssignmentListItem): { type: AssignmentTargetType; id?: string | null } {
  const targets = item.targets ?? [];
  const teamTarget = targets.find((t) => t.target_type === 'team');
  if (teamTarget) return { type: 'team' };
  const groupTarget = targets.find((t) => t.target_type === 'group');
  if (groupTarget) return { type: 'group', id: groupTarget.target_id ?? null };
  const playerTarget = targets.find((t) => t.target_type === 'player');
  if (playerTarget) return { type: 'player', id: playerTarget.target_id ?? null };
  return { type: 'team' };
}

type AssignmentStatus = 'overdue' | 'due_soon' | 'completed' | 'upcoming';

type AssignmentRow = {
  id: string;
  title: string;
  description: string | null;
  clipCount: number;
  dueAt: Date | null;
  targetLabel: string;
  totalAssignees: number;
  completedCount: number;
  progress01: number;
  status: AssignmentStatus;
  targetTypes: Set<string>;
  targetGroupIds: Set<string>;
  assigneeIds: Set<string>;
};

const assignmentRows = computed<AssignmentRow[]>(() => {
  const now = new Date();
  const dueSoonCutoff = new Date(now);
  dueSoonCutoff.setDate(now.getDate() + 7);
  const completedMap = completedByAssignment.value;

  return assignments.value.map((item) => {
    const assignees = assignmentAssignees(item);
    const completedSet = completedMap.get(item.id) ?? new Set<string>();
    let completedCount = 0;
    for (const id of assignees) {
      if (completedSet.has(id)) completedCount += 1;
    }

    const totalAssignees = assignees.size;
    const isCompleted = totalAssignees > 0 && completedCount >= totalAssignees;
    const dueAt = item.due_at ? new Date(item.due_at) : null;

    let status: AssignmentStatus = 'upcoming';
    if (isCompleted) {
      status = 'completed';
    } else if (dueAt && dueAt < now) {
      status = 'overdue';
    } else if (dueAt && dueAt <= dueSoonCutoff) {
      status = 'due_soon';
    }

    const targetLabels = assignmentTargetLabels(item);
    const targetLabel = targetLabels.length > 0 ? targetLabels.join(', ') : 'Team';
    const progress01 = totalAssignees > 0 ? completedCount / totalAssignees : 0;

    return {
      id: item.id,
      title: item.title?.trim() || 'Untitled assignment',
      description: item.description ?? null,
      clipCount: item.clipCount,
      dueAt,
      targetLabel,
      totalAssignees,
      completedCount,
      progress01,
      status,
      targetTypes: assignmentTargetTypes(item),
      targetGroupIds: assignmentTargetGroupIds(item),
      assigneeIds: assignees,
    } satisfies AssignmentRow;
  });
});

const filteredRows = computed(() => {
  return assignmentRows.value.filter((row) => {
    if (assignmentIdFilter.value && row.id !== assignmentIdFilter.value) return false;
    if (assignmentIdFilter.value) return true;
    if (statusFilter.value !== 'all' && row.status !== statusFilter.value) return false;
    if (targetFilter.value !== 'all' && !row.targetTypes.has(targetFilter.value)) return false;
    if (groupFilter.value !== 'all' && !row.targetGroupIds.has(groupFilter.value)) return false;
    if (playerFilter.value !== 'all' && !row.assigneeIds.has(playerFilter.value)) return false;
    return true;
  });
});

const sections = computed(() => {
  const rows = filteredRows.value;
  return {
    overdue: rows.filter((row) => row.status === 'overdue'),
    dueSoon: rows.filter((row) => row.status === 'due_soon' || (statusFilter.value === 'all' && row.status === 'upcoming')),
    completed: rows.filter((row) => row.status === 'completed'),
  };
});

const hasResults = computed(() => {
  return sections.value.overdue.length > 0 || sections.value.dueSoon.length > 0 || sections.value.completed.length > 0;
});

function metaLine(row: AssignmentRow): string {
  const parts = [row.targetLabel, clipLabel(row.clipCount)];
  const dueLabel = formatDue(row.dueAt);
  if (dueLabel) parts.push(`Due ${dueLabel}`);
  return parts.join(' • ');
}

const editInitial = computed(() => {
  if (!editingAssignment.value) return null;
  const target = primaryTarget(editingAssignment.value);
  return {
    title: editingAssignment.value.title ?? '',
    description: editingAssignment.value.description ?? null,
    dueAt: editingAssignment.value.due_at ?? null,
    targetType: target.type,
    targetId: target.id ?? null,
  };
});

function clearAssignmentFocus() {
  assignmentIdFilter.value = '';
}

function openEdit(assignmentId: string) {
  if (!canManage.value) return;
  const assignment = assignmentById.value.get(assignmentId);
  if (!assignment) return;
  editingAssignment.value = assignment;
}

function closeEdit() {
  editingAssignment.value = null;
}

async function requestDelete(assignmentId: string) {
  if (!canManage.value) return;
  const assignment = assignmentById.value.get(assignmentId);
  if (!assignment) return;
  const title = assignment.title?.trim() || 'Untitled assignment';
  const ok = window.confirm(`Delete "${title}"? This cannot be undone.`);
  if (!ok) return;

  try {
    await assignmentsService.deleteAssignment(assignmentId);
    assignments.value = assignments.value.filter((item) => item.id !== assignmentId);
    progressRows.value = progressRows.value.filter((row) => row.assignment_id !== assignmentId);
    if (editingAssignment.value?.id === assignmentId) closeEdit();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to delete assignment.';
  }
}

function mapTargets(assignmentId: string, targets: AssignmentTargetInput[]): OrgAssignmentTarget[] {
  return targets.map((target) => ({
    assignment_id: assignmentId,
    target_type: target.type,
    target_id: target.type === 'team' ? null : (target.id ?? null),
  }));
}

async function handleEdit(payload: {
  title: string;
  description: string | null;
  dueAt: string | null;
  targets: AssignmentTargetInput[];
}) {
  if (!editingAssignment.value) return;

  try {
    const assignmentId = editingAssignment.value.id;
    await assignmentsService.updateAssignment(assignmentId, {
      title: payload.title,
      description: payload.description ?? null,
      dueAt: payload.dueAt ?? null,
    });
    await assignmentsService.replaceAssignmentTargets(assignmentId, payload.targets);

    assignments.value = assignments.value.map((assignment) => {
      if (assignment.id !== assignmentId) return assignment;
      return {
        ...assignment,
        title: payload.title,
        description: payload.description ?? null,
        due_at: payload.dueAt ?? null,
        targets: mapTargets(assignmentId, payload.targets),
      };
    });
    closeEdit();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to update assignment.';
  }
}

function openAssignment(assignmentId: string) {
  if (!orgSlug.value) return;
  void router.push({
    name: 'OrgFeedView',
    params: { slug: orgSlug.value },
    query: { source: 'assignments', assignmentId },
  });
}

const groupOptions = computed(() => {
  return groups.value.map((g) => ({ id: g.group.id, name: g.group.name }));
});

const playerOptions = computed(() => {
  return members.value.map((member) => ({
    id: member.profile.id,
    name: member.profile.name || member.profile.username || 'Player',
  }));
});

const groupList = computed(() => {
  return groups.value.map((g) => g.group);
});

onMounted(() => {
  void load();
});

watch(orgId, (next, prev) => {
  if (next && next !== prev) void load();
});

watch(
  () => route.query,
  () => {
    syncFiltersFromQuery();
  },
  { immediate: true }
);

watch(
  () => [statusFilter.value, targetFilter.value, groupFilter.value, playerFilter.value],
  (next, prev) => {
    if (!isSyncingFilters.value && assignmentIdFilter.value) {
      const [nextStatus, nextTarget, nextGroup, nextPlayer] = next;
      const [prevStatus, prevTarget, prevGroup, prevPlayer] = prev ?? [];
      const filtersChanged = nextStatus !== prevStatus
        || nextTarget !== prevTarget
        || nextGroup !== prevGroup
        || nextPlayer !== prevPlayer;
      if (filtersChanged) assignmentIdFilter.value = '';
    }
    syncQueryFromFilters();
  }
);

watch(targetFilter, (nextTarget, prevTarget) => {
  if (isSyncingFilters.value || nextTarget === prevTarget) return;
  if (nextTarget !== 'group') groupFilter.value = 'all';
  if (nextTarget !== 'player') playerFilter.value = 'all';
});

watch(assignmentIdFilter, () => {
  syncQueryFromFilters();
});

watch(groupOptions, (nextOptions) => {
  if (groupFilter.value === 'all') return;
  const hasMatch = nextOptions.some((option) => option.id === groupFilter.value);
  if (!hasMatch) groupFilter.value = 'all';
});

watch(playerOptions, (nextOptions) => {
  if (playerFilter.value === 'all') return;
  const hasMatch = nextOptions.some((option) => option.id === playerFilter.value);
  if (!hasMatch) playerFilter.value = 'all';
});

</script>

<template>
  <div class="container py-8 text-white">
    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-3xl tracking-tight">Assignments</h1>
        <p class="text-sm text-white/50">Track what was assigned, who is behind, and what’s due soon.</p>
      </div>

      <div v-if="assignmentIdFilter" class="flex flex-wrap items-center gap-3 text-xs text-white/70">
        <button
          type="button"
          class="rounded border border-white/10 bg-black/70 px-3 py-1 text-xs text-white/70 transition hover:text-white"
          @click="clearAssignmentFocus"
        >
          Show all assignments
        </button>
      </div>

      <div v-else class="flex flex-wrap items-center gap-3 text-xs text-white/70">
        <label class="flex items-center gap-2">
          <span class="text-white/40">Status</span>
          <select
            v-model="statusFilter"
            class="rounded bg-black/70 px-2 py-1 text-white ring-1 ring-white/10"
          >
            <option value="all">All</option>
            <option value="overdue">Overdue</option>
            <option value="due_soon">Due Soon</option>
            <option value="completed">Completed</option>
          </select>
        </label>

        <label class="flex items-center gap-2">
          <span class="text-white/40">Target</span>
          <select
            v-model="targetFilter"
            class="rounded bg-black/70 px-2 py-1 text-white ring-1 ring-white/10"
          >
            <option value="all">All</option>
            <option value="team">Team</option>
            <option value="group">Group</option>
            <option value="player">Player</option>
          </select>
        </label>

        <label v-if="targetFilter !== 'player' && groupOptions.length > 0" class="flex items-center gap-2">
          <span class="text-white/40">Group</span>
          <select
            v-model="groupFilter"
            class="rounded bg-black/70 px-2 py-1 text-white ring-1 ring-white/10"
          >
            <option value="all">All</option>
            <option v-for="g in groupOptions" :key="g.id" :value="g.id">
              {{ g.name }}
            </option>
          </select>
        </label>

        <label v-else-if="targetFilter === 'player' && playerOptions.length > 0" class="flex items-center gap-2">
          <span class="text-white/40">Player</span>
          <select
            v-model="playerFilter"
            class="rounded bg-black/70 px-2 py-1 text-white ring-1 ring-white/10"
          >
            <option value="all">All</option>
            <option v-for="p in playerOptions" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
        </label>
      </div>
    </div>

    <div v-if="error" class="mt-6 text-sm text-red-200">
      {{ error }}
    </div>

    <div v-else-if="loading" class="mt-6 text-white/60">Loading assignments…</div>

    <div v-else-if="assignments.length === 0" class="mt-6 text-white/50">
      No assignments yet.
    </div>

    <div v-else class="mt-8 space-y-10">
      <div v-if="!hasResults" class="text-white/50">No assignments match your filters.</div>

      <section v-if="sections.overdue.length > 0" class="space-y-4">
        <h2 class="text-lg text-white/80">Overdue</h2>
        <div class="space-y-4">
          <div
            v-for="row in sections.overdue"
            :key="row.id"
            class="group cursor-pointer rounded-lg px-2 py-3 transition hover:bg-white/5"
            role="button"
            tabindex="0"
            @click="openAssignment(row.id)"
            @keydown.enter.prevent="openAssignment(row.id)"
          >
            <div class="flex items-start justify-between gap-6">
              <div class="min-w-0">
                <div class="text-base text-white line-clamp-1">
                  {{ row.title }}
                </div>
                <div class="mt-1 text-xs text-white/50 line-clamp-1">
                  {{ metaLine(row) }}
                </div>
                <div v-if="row.description" class="mt-2 text-xs text-white/40 line-clamp-2">
                  {{ row.description }}
                </div>
              </div>

              <div class="shrink-0 text-right">
                <div class="text-xs text-white/60">
                  {{ row.completedCount }} / {{ row.totalAssignees }} reviewed
                </div>
                <div class="mt-2 h-1 w-24 rounded-full bg-white/10">
                  <div
                    class="h-full rounded-full bg-white/40"
                    :style="{ width: `${Math.round(row.progress01 * 100)}%` }"
                  />
                </div>
                <div v-if="canManage" class="mt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    class="text-xs text-white/50 transition hover:text-white/80 hover:cursor-pointer"
                    @click.stop="openEdit(row.id)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="text-xs text-red-200/80 transition hover:text-red-200 hover:cursor-pointer"
                    @click.stop="requestDelete(row.id)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="sections.dueSoon.length > 0" class="space-y-4">
        <h2 class="text-lg text-white/80">Due Soon</h2>
        <div class="space-y-4">
          <div
            v-for="row in sections.dueSoon"
            :key="row.id"
            class="group cursor-pointer rounded-lg px-2 py-3 transition hover:bg-white/5"
            role="button"
            tabindex="0"
            @click="openAssignment(row.id)"
            @keydown.enter.prevent="openAssignment(row.id)"
          >
            <div class="flex items-start justify-between gap-6">
              <div class="min-w-0">
                <div class="text-base text-white line-clamp-1">
                  {{ row.title }}
                </div>
                <div class="mt-1 text-xs text-white/50 line-clamp-1">
                  {{ metaLine(row) }}
                </div>
                <div v-if="row.description" class="mt-2 text-xs text-white/40 line-clamp-2">
                  {{ row.description }}
                </div>
              </div>

              <div class="shrink-0 text-right">
                <div class="text-xs text-white/60">
                  {{ row.completedCount }} / {{ row.totalAssignees }} reviewed
                </div>
                <div class="mt-2 h-1 w-24 rounded-full bg-white/10">
                  <div
                    class="h-full rounded-full bg-white/40"
                    :style="{ width: `${Math.round(row.progress01 * 100)}%` }"
                  />
                </div>
                <div v-if="canManage" class="mt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    class="text-xs text-white/50 transition hover:text-white/80 hover:cursor-pointer"
                    @click.stop="openEdit(row.id)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="text-xs text-red-200/80 transition hover:text-red-200 hover:cursor-pointer"
                    @click.stop="requestDelete(row.id)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="sections.completed.length > 0" class="space-y-4">
        <h2 class="text-lg text-white/80">Completed</h2>
        <div class="space-y-4">
          <div
            v-for="row in sections.completed"
            :key="row.id"
            class="group cursor-pointer rounded-lg px-2 py-3 transition hover:bg-white/5"
            role="button"
            tabindex="0"
            @click="openAssignment(row.id)"
            @keydown.enter.prevent="openAssignment(row.id)"
          >
            <div class="flex items-start justify-between gap-6">
              <div class="min-w-0">
                <div class="text-base text-white line-clamp-1">
                  {{ row.title }}
                </div>
                <div class="mt-1 text-xs text-white/50 line-clamp-1">
                  {{ metaLine(row) }}
                </div>
                <div v-if="row.description" class="mt-2 text-xs text-white/40 line-clamp-2">
                  {{ row.description }}
                </div>
              </div>

              <div class="shrink-0 text-right">
                <div class="text-xs text-white/60">
                  {{ row.completedCount }} / {{ row.totalAssignees }} reviewed
                </div>
                <div class="mt-2 h-1 w-24 rounded-full bg-white/10">
                  <div
                    class="h-full rounded-full bg-white/40"
                    :style="{ width: `${Math.round(row.progress01 * 100)}%` }"
                  />
                </div>
                <div v-if="canManage" class="mt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    class="text-xs text-white/50 transition hover:text-white/80 hover:cursor-pointer"
                    @click.stop="openEdit(row.id)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="text-xs text-red-200/80 transition hover:text-red-200 hover:cursor-pointer"
                    @click.stop="requestDelete(row.id)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <CreateAssignmentModal
      v-if="editingAssignment"
      mode="edit"
      :members="members"
      :groups="groupList"
      :initial="editInitial"
      @close="closeEdit"
      @submit="handleEdit"
    />
  </div>
</template>

<style scoped>
/* intentionally empty */
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { getRelativeDaysWeeks } from '@/lib/date';
import { toast } from '@/lib/toast';
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
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';

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
const selectAllCheckbox = ref<HTMLInputElement | null>(null);
const showDeleteModal = ref(false);
const deleteAssignmentId = ref<string | null>(null);
const deleteAssignmentName = ref('this assignment');
const deleteError = ref<string | null>(null);
const isDeleting = ref(false);
const isBulkDelete = ref(false);
const extendByDays = ref<number | null>(null);
const isExtending = ref(false);
const extendDropdownOpen = ref(false);
const extendDropdownRef = ref<HTMLDivElement | null>(null);
const extendOptions = [
  { value: 1, label: '1 day' },
  { value: 2, label: '2 days' },
  { value: 3, label: '3 days' },
  { value: 7, label: '1 week' },
] as const;

const extendSelectedLabel = computed(() => {
  if (!extendByDays.value) return 'Select';
  const match = extendOptions.find((opt) => opt.value === extendByDays.value);
  return match?.label ?? 'Select';
});

const statusFilter = ref<'all' | 'overdue' | 'due_soon' | 'completed'>('all');
const targetFilter = ref<'all' | 'team' | 'group' | 'player'>('all');
const groupFilter = ref('all');
const playerFilter = ref('all');
const assignmentIdFilter = ref('');
const selectedAssignmentIds = ref<string[]>([]);

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
  statusFilter.value = nextStatus && statusFilterOptions.has(nextStatus) ? (nextStatus as typeof statusFilter.value) : 'all';

  const nextTarget = getQueryValue(route.query.target);
  targetFilter.value = nextTarget && targetFilterOptions.has(nextTarget) ? (nextTarget as 'team' | 'group' | 'player') : 'all';

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

  const nextQuery = { ...route.query };
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

const memberNameById = computed(() => {
  const map = new Map<string, string>();
  for (const member of members.value) {
    const name = member.profile.name || member.profile.username || 'Player';
    map.set(member.profile.id, name);
  }
  return map;
});

const teamMemberIds = computed(() => {
  return members.value
    .filter((member) => member.membership.role === 'member')
    .map((member) => member.profile.id);
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
  const memberIds = teamMemberIds.value;
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

const baseFilteredRows = computed(() => {
  return assignmentRows.value.filter((row) => {
    if (assignmentIdFilter.value && row.id !== assignmentIdFilter.value) return false;
    if (assignmentIdFilter.value) return true;
    if (targetFilter.value !== 'all' && !row.targetTypes.has(targetFilter.value)) return false;
    if (groupFilter.value !== 'all' && !row.targetGroupIds.has(groupFilter.value)) return false;
    if (playerFilter.value !== 'all' && !row.assigneeIds.has(playerFilter.value)) return false;
    return true;
  });
});

const filteredRows = computed(() => {
  return baseFilteredRows.value.filter((row) => {
    if (statusFilter.value !== 'all') {
      if (statusFilter.value === 'due_soon') {
        if (row.status !== 'due_soon' && row.status !== 'upcoming') return false;
      } else if (row.status !== statusFilter.value) {
        return false;
      }
    }
    return true;
  });
});

const statusCounts = computed(() => {
  const rows = baseFilteredRows.value;
  return {
    due: rows.filter((row) => row.status === 'due_soon' || row.status === 'upcoming').length,
    overdue: rows.filter((row) => row.status === 'overdue').length,
    completed: rows.filter((row) => row.status === 'completed').length,
  };
});

const sections = computed(() => {
  const rows = filteredRows.value;
  return {
    overdue: rows.filter((row) => row.status === 'overdue'),
    dueSoon: rows.filter((row) => row.status === 'due_soon' || (statusFilter.value === 'all' && row.status === 'upcoming')),
    completed: rows.filter((row) => row.status === 'completed'),
  };
});

const visibleRowIds = computed(() => {
  const rows = filteredRows.value;
  return rows.map((row) => row.id);
});

const selectedCount = computed(() => selectedAssignmentIds.value.length);

const selectedIdSet = computed(() => new Set(selectedAssignmentIds.value));

const allVisibleSelected = computed(() => {
  const visibleIds = visibleRowIds.value;
  if (visibleIds.length === 0) return false;
  const selected = selectedIdSet.value;
  return visibleIds.every((id) => selected.has(id));
});

const hasResults = computed(() => {
  return sections.value.overdue.length > 0 || sections.value.dueSoon.length > 0 || sections.value.completed.length > 0;
});

function metaLine(row: AssignmentRow): string {
  const target = row.targetLabel || 'Team';
  const base = `to ${target}`;
  if (!row.dueAt) return base;

  const relative = getRelativeDaysWeeks(row.dueAt, new Date());
  if (!relative) return base;

  const unitLabel = relative.count === 1 ? relative.unit : `${relative.unit}s`;
  const timeLabel = relative.count === 0 ? 'today' : `${relative.count} ${unitLabel}`;

  if (row.status === 'completed') {
    if (!relative.isPast || relative.count === 0) return `${base} completed today`;
    return `${base} completed ${timeLabel} ago`;
  }

  if (row.status === 'overdue') {
    if (relative.count === 0) return `${base} overdue today`;
    return `${base} overdue by ${timeLabel}`;
  }

  if (relative.count === 0) return `${base} due today`;
  return `${base} due in ${timeLabel}`;
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

function setDueTab() {
  statusFilter.value = 'due_soon';
}

function setCompletedTab() {
  statusFilter.value = 'completed';
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
  deleteAssignmentId.value = assignmentId;
  deleteAssignmentName.value = assignment.title?.trim() || 'this assignment';
  deleteError.value = null;
  showDeleteModal.value = true;
}

function closeDeleteModal(force = false) {
  if (isDeleting.value && !force) return;
  showDeleteModal.value = false;
  deleteError.value = null;
  deleteAssignmentId.value = null;
  isBulkDelete.value = false;
}

async function confirmDeleteAssignment() {
  if (isDeleting.value) return;
  const ids = isBulkDelete.value
    ? selectedAssignmentIds.value
    : deleteAssignmentId.value
      ? [deleteAssignmentId.value]
      : [];
  if (ids.length === 0) return;
  isDeleting.value = true;
  deleteError.value = null;

  try {
    await Promise.all(ids.map((id) => assignmentsService.deleteAssignment(id)));
    assignments.value = assignments.value.filter((item) => !ids.includes(item.id));
    progressRows.value = progressRows.value.filter((row) => !ids.includes(row.assignment_id));
    if (editingAssignment.value && ids.includes(editingAssignment.value.id)) closeEdit();
    if (isBulkDelete.value) selectedAssignmentIds.value = [];
    if (isBulkDelete.value) {
      toast({
        variant: 'success',
        message: `Deleted ${ids.length} assignment${ids.length === 1 ? '' : 's'}.`,
        durationMs: 2500,
      });
    }
    closeDeleteModal(true);
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete assignments.';
    if (isBulkDelete.value) {
      toast({
        variant: 'error',
        message: deleteError.value ?? 'Failed to delete assignments.',
        durationMs: 3000,
      });
    }
  } finally {
    isDeleting.value = false;
  }
}

async function requestDeleteBulk() {
  if (!canManage.value) return;
  const ids = selectedAssignmentIds.value;
  if (ids.length === 0) return;
  isBulkDelete.value = true;
  deleteAssignmentId.value = null;
  deleteAssignmentName.value = ids.length === 1 ? 'this assignment' : `${ids.length} assignments`;
  deleteError.value = null;
  showDeleteModal.value = true;
}

async function extendSelectedAssignments() {
  if (!canManage.value) return;
  if (isExtending.value) return;
  const days = extendByDays.value;
  const ids = selectedAssignmentIds.value;
  if (!days || ids.length === 0) return;

  isExtending.value = true;
  error.value = null;

  try {
    const updates = ids
      .map((id) => assignmentById.value.get(id))
      .filter((item): item is OrgAssignmentListItem => Boolean(item))
      .map((item) => {
        const base = item.due_at ? new Date(item.due_at) : new Date();
        const next = new Date(base);
        next.setDate(base.getDate() + days);
        return { id: item.id, dueAt: next.toISOString() };
      });

    await Promise.all(updates.map((u) => {
      const current = assignmentById.value.get(u.id);
      const title = current?.title?.trim() || 'Untitled assignment';
      const description = current?.description ?? null;
      return assignmentsService.updateAssignment(u.id, { title, description, dueAt: u.dueAt });
    }));

    assignments.value = assignments.value.map((item) => {
      const update = updates.find((u) => u.id === item.id);
      if (!update) return item;
      return { ...item, due_at: update.dueAt };
    });
    toast({
      variant: 'success',
      message: `Extended ${updates.length} assignment${updates.length === 1 ? '' : 's'} by ${days} day${days === 1 ? '' : 's'}.`,
      durationMs: 2500,
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to extend assignments.';
    toast({
      variant: 'error',
      message: error.value ?? 'Failed to extend assignments.',
      durationMs: 3000,
    });
  } finally {
    isExtending.value = false;
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

function toggleRowSelection(id: string, checked: boolean) {
  const next = new Set(selectedAssignmentIds.value);
  if (checked) {
    next.add(id);
  } else {
    next.delete(id);
  }
  selectedAssignmentIds.value = Array.from(next);
}

function toggleSelectAllVisible(checked: boolean) {
  const next = new Set(selectedAssignmentIds.value);
  if (checked) {
    for (const id of visibleRowIds.value) next.add(id);
  } else {
    for (const id of visibleRowIds.value) next.delete(id);
  }
  selectedAssignmentIds.value = Array.from(next);
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
  document.addEventListener('click', handleExtendDropdownOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleExtendDropdownOutside);
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

watch(filteredRows, () => {
  const visible = new Set(visibleRowIds.value);
  selectedAssignmentIds.value = selectedAssignmentIds.value.filter((id) => visible.has(id));
});

watch([selectedCount, visibleRowIds], () => {
  const el = selectAllCheckbox.value;
  if (!el) return;
  const total = visibleRowIds.value.length;
  const selected = selectedCount.value;
  el.indeterminate = selected > 0 && selected < total;
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

function toggleExtendDropdown(event: MouseEvent) {
  if (!canManage.value) return;
  event.stopPropagation();
  extendDropdownOpen.value = !extendDropdownOpen.value;
}

function selectExtendOption(value: number) {
  extendByDays.value = value;
  extendDropdownOpen.value = false;
}

function handleExtendDropdownOutside(event: MouseEvent) {
  if (!extendDropdownRef.value) return;
  if (!extendDropdownRef.value.contains(event.target as Node)) {
    extendDropdownOpen.value = false;
  }
}

</script>

<template>
  <div class="container py-8 text-white">
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="text-3xl tracking-tight">Assignments</h1>
        <p class="text-sm text-white/50">Track what was assigned, who is behind, and what’s due soon.</p>
      </div>

      <div class="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white/70 md:flex-row md:items-center md:justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <label class="flex items-center gap-2 text-white/60">
            <input
              ref="selectAllCheckbox"
              type="checkbox"
              class="h-3.5 w-3.5 accent-sky-400"
              :checked="allVisibleSelected"
              :disabled="visibleRowIds.length === 0 || !canManage"
              @change="toggleSelectAllVisible(($event.target as HTMLInputElement).checked)"
              @click="(event) => {
                const target = event.target as HTMLInputElement;
                if (target.indeterminate) {
                  event.preventDefault();
                  target.indeterminate = false;
                  target.checked = false;
                  toggleSelectAllVisible(false);
                }
              }"
            />
          </label>

          <div v-if="selectedCount > 0" class="font-semibold flex items-center gap-2 text-xs text-white/60">
            <span>{{ selectedCount }} of {{ visibleRowIds.length }} selected</span>
          </div>

          <div v-else class="flex items-center">
            <button
              type="button"
              class="rounded px-2 py-1 text-xs transition hover:cursor-pointer hover:bg-white/10"
              :class="statusFilter === 'due_soon' ? 'font-semibold text-white' : 'text-white/40 hover:text-white/70'"
              @click="setDueTab"
            >
              <span>Due</span>
              <span class="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px] text-white/70">
                {{ statusCounts.due }}
              </span>
            </button>
            <button
              type="button"
              class="rounded px-2 py-1 text-xs transition hover:cursor-pointer hover:bg-white/10"
              :class="statusFilter === 'overdue' ? 'font-semibold text-white' : 'text-white/40 hover:text-white/70'"
              @click="() => { statusFilter = 'overdue'; }"
            >
              <span>Overdue</span>
              <span class="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px] text-white/70">
                {{ statusCounts.overdue }}
              </span>
            </button>
            <button
              type="button"
              class="rounded px-2 py-1 text-xs transition hover:cursor-pointer hover:bg-white/10"
              :class="statusFilter === 'completed' ? 'font-semibold text-white' : 'text-white/40 hover:text-white/70'"
              @click="setCompletedTab"
            >
              <span>Completed</span>
              <span class="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px] text-white/70">
                {{ statusCounts.completed }}
              </span>
            </button>
          </div>

          <button
            v-if="assignmentIdFilter"
            type="button"
            class="rounded border border-white/10 bg-black/70 px-2 py-1 text-xs text-white/70 transition hover:text-white"
            @click="clearAssignmentFocus"
          >
            Show all assignments
          </button>
        </div>

        <div v-if="selectedCount > 0" class="flex flex-wrap items-center gap-3 text-xs">
          <div ref="extendDropdownRef" class="relative">
            <button
              type="button"
              class="flex items-center gap-2 rounded border border-white/10 bg-black/70 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canManage"
              @click="toggleExtendDropdown"
            >
              <span class="text-white/40">Extend by</span>
              <span class="text-white/80">{{ extendSelectedLabel }}</span>
              <svg class="h-3.5 w-3.5 text-white/50" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clip-rule="evenodd" />
              </svg>
            </button>

            <div
              v-if="extendDropdownOpen"
              class="absolute left-0 mt-2 w-40 rounded-lg border border-white/10 bg-black/90 p-1 text-xs text-white/80 shadow-lg"
              role="listbox"
            >
              <button
                v-for="option in extendOptions"
                :key="option.value"
                type="button"
                class="flex w-full items-center justify-between rounded px-2 py-1 text-left transition hover:bg-white/10"
                :class="option.value === extendByDays ? 'bg-white/10 text-white' : ''"
                @click="selectExtendOption(option.value)"
              >
                <span>{{ option.label }}</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            class="rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80 transition hover:bg-white/20 disabled:opacity-50"
            :disabled="!canManage || !extendByDays || isExtending"
            @click="extendSelectedAssignments"
          >
            Extend
          </button>
          <button
            v-if="canManage"
            type="button"
            class="rounded-lg border border-red-500 bg-red-500/70 px-3 py-1 text-xs text-white transition hover:bg-red-700/70"
            @click="requestDeleteBulk"
          >
            Delete selected
          </button>
        </div>

        <div v-else class="flex flex-wrap items-center gap-3">
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
    </div>

    <div v-if="error" class="mt-6 text-sm text-red-200">
      {{ error }}
    </div>

    <div v-else-if="loading" class="mt-6 text-white/60">Loading assignments…</div>

    <div v-else-if="assignments.length === 0" class="mt-6 text-white/50">
      No assignments yet.
    </div>

    <div v-else class="mt-8 space-y-4">
      <div v-if="!hasResults" class="text-white/50">No assignments match your filters.</div>

      <div v-else class="divide-y divide-white/10">
        <div
          v-for="row in filteredRows"
          :key="row.id"
          class="group px-2 py-3 transition"
          :class="selectedIdSet.has(row.id)
            ? 'border border-sky-400/40 bg-sky-500/10'
            : 'border border-transparent hover:bg-white/5'"
        >
          <div class="flex items-start justify-between gap-6">
            <div class="flex min-w-0 items-start gap-3">
              <input
                type="checkbox"
                class="mt-1 h-3.5 w-3.5 accent-sky-400"
                :checked="selectedIdSet.has(row.id)"
                :disabled="!canManage"
                @click.stop
                @change="toggleRowSelection(row.id, ($event.target as HTMLInputElement).checked)"
              />
              <div class="min-w-0">
                <span
                  class="font-semibold text-sm tracking-wide text-white line-clamp-1 hover:text-sky-500/80 hover:underline hover:cursor-pointer"
                  role="link"
                  tabindex="0"
                  @click="openAssignment(row.id)"
                  @keydown.enter.prevent="openAssignment(row.id)"
                >
                  {{ row.title }}
                </span>
                <div class="mt-1 text-xs text-white/50 line-clamp-1">
                  {{ metaLine(row) }}
                </div>
                <div v-if="row.description" class="mt-2 text-xs text-white/40 line-clamp-2">
                  {{ row.description }}
                </div>
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

    <ConfirmDeleteModal
      :show="showDeleteModal"
      :item-name="deleteAssignmentName"
      popup-title="Delete Assignment"
      :is-deleting="isDeleting"
      :error="deleteError"
      @confirm="confirmDeleteAssignment"
      @cancel="closeDeleteModal"
      @close="closeDeleteModal"
    />
  </div>
</template>

<style scoped>
/* intentionally empty */
</style>

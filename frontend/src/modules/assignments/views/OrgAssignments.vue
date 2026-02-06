<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import AssignmentActionsMenu from '@/components/AssignmentActionsMenu.vue';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { formatRelativeTime } from '@/lib/date';
import { toast } from '@/lib/toast';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { orgService } from '@/modules/orgs/services/orgServiceV2';
import type { OrgMember } from '@/modules/orgs/types';

import { groupsService } from '@/modules/groups/services/groupsService';
import type { OrgGroup } from '@/modules/groups/types';

import {
  assignmentsService,
  type AssignmentTargetInput,
} from '@/modules/assignments/services/assignmentsService';
import type { OrgAssignmentListItem } from '@/modules/assignments/types';
import CreateAssignmentModal from '@/modules/assignments/components/CreateAssignmentModal.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';

type StatusOption = {
  value: 'all' | 'due' | 'overdue' | 'completed';
  label: string;
};

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
const editingAssignment = ref<OrgAssignmentListItem | null>(null);
const showDeleteModal = ref(false);
const deleteAssignmentId = ref<string | null>(null);
const deleteAssignmentName = ref('this assignment');
const deleteError = ref<string | null>(null);
const isDeleting = ref(false);

// Pagination state
const currentPage = ref(1);
const itemsPerPage = ref(10);
const totalAssignments = ref(0); // Total count from server for pagination

// Server-paginated assignment data (replaces old client-side data)
const serverAssignments = ref<import('@/modules/assignments/types').AssignmentWithProgress[]>([]);

// Combobox state
const groupQuery = ref('');
const playerQuery = ref('');

type ComboOption = {
  id: string;
  label: string;
};

const selectedGroupOption = ref<ComboOption>({ id: 'all', label: 'All' });
const selectedPlayerOption = ref<ComboOption>({ id: 'all', label: 'All' });

const statusOptionList: StatusOption[] = [
  { value: 'all', label: 'All' },
  { value: 'due', label: 'Due' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
];
const selectedStatusOption = ref<StatusOption>(statusOptionList[0]!);

const statusFilter = computed({
  get: () => selectedStatusOption.value.value,
  set: (val) => {
    const option = statusOptionList.find(o => o.value === val);
    if (option) selectedStatusOption.value = option;
  },
});

const groupFilter = ref('all');
const playerFilter = ref('all');

const statusFilterOptions = new Set(['all', 'due', 'overdue', 'completed']);
const isSyncingFilters = ref(false);

const getQueryValue = (value: unknown): string | null => {
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : null;
  if (typeof value === 'string') return value;
  if (value == null) return null;
  return String(value);
};

const isFilterQueryInSync = () => {
  const queryStatus = getQueryValue(route.query.status);
  const queryGroup = getQueryValue(route.query.group);
  const queryPlayer = getQueryValue(route.query.player);

  const statusMatches = statusFilter.value === 'all'
    ? queryStatus == null
    : queryStatus === statusFilter.value;
  const groupMatches = groupFilter.value === 'all'
    ? queryGroup == null
    : queryGroup === groupFilter.value;
  const playerMatches = playerFilter.value === 'all'
    ? queryPlayer == null
    : queryPlayer === playerFilter.value;

  return statusMatches && groupMatches && playerMatches;
};

const syncFiltersFromQuery = () => {
  isSyncingFilters.value = true;
  try {
    const nextStatus = getQueryValue(route.query.status);
    statusFilter.value = nextStatus && statusFilterOptions.has(nextStatus) ? (nextStatus as typeof statusFilter.value) : 'all';

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
  delete nextQuery.group;
  delete nextQuery.player;

  if (statusFilter.value !== 'all') nextQuery.status = statusFilter.value;
  if (groupFilter.value !== 'all') nextQuery.group = groupFilter.value;
  if (playerFilter.value !== 'all') nextQuery.player = playerFilter.value;

  void router.replace({ query: nextQuery });
};

async function load() {
  if (!orgId.value) return;

  loading.value = true;
  error.value = null;

  try {
    // Load members/groups for comboboxes only
    const [memberRows, groupRows] = await Promise.all([
      orgService.listMembers(orgId.value),
      groupsService.getGroupsForOrg(orgId.value),
    ]);

    members.value = memberRows;
    groups.value = groupRows;

    // Load paginated assignments with progress (single RPC call!)
    await loadAssignmentsPage();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load assignments.';
  } finally {
    loading.value = false;
  }
}

async function loadAssignmentsPage() {
  if (!orgId.value) return;

  const offset = (currentPage.value - 1) * itemsPerPage.value;

  try {
    const [assignmentsData, totalCount] = await Promise.all([
      assignmentsService.getAssignmentsWithProgress({
        orgId: orgId.value,
        status: statusFilter.value === 'all' ? undefined : statusFilter.value as any,
        groupId: groupFilter.value === 'all' ? undefined : groupFilter.value,
        userId: playerFilter.value === 'all' ? undefined : playerFilter.value,
        limit: itemsPerPage.value,
        offset,
      }),
      assignmentsService.getAssignmentsCount({
        orgId: orgId.value,
        status: statusFilter.value === 'all' ? undefined : statusFilter.value,
        groupId: groupFilter.value === 'all' ? undefined : groupFilter.value,
        userId: playerFilter.value === 'all' ? undefined : playerFilter.value,
      }),
    ]);

    serverAssignments.value = assignmentsData;
    totalAssignments.value = totalCount;
  } catch (e) {
    console.error('Failed to load assignments page:', e);
    serverAssignments.value = [];
    totalAssignments.value = 0;
  }
}

// Keep assignmentById for backwards compatibility with edit/delete modals
const assignmentById = computed(() => {
  // Convert serverAssignments to OrgAssignmentListItem format for modals
  const map = new Map<string, OrgAssignmentListItem>();
  for (const item of serverAssignments.value) {
    map.set(item.id, {
      id: item.id,
      org_id: orgId.value!,
      created_by: item.created_by,
      title: item.title,
      description: item.description,
      due_at: item.due_at,
      created_at: item.created_at,
      targets: item.targets,
      clipCount: item.clip_count,
    });
  }
  return map;
});

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
  createdAt?: Date | null;
};

// Simplified: Use server data directly (no heavy client-side transformations)
const assignmentRows = computed<AssignmentRow[]>(() => {
  return serverAssignments.value.map((item) => ({
    id: item.id,
    title: item.title?.trim() || 'Untitled assignment',
    description: item.description ?? null,
    clipCount: item.clip_count,
    dueAt: item.due_at ? new Date(item.due_at) : null,
    targetLabel: item.target_label,
    totalAssignees: item.total_assignees,
    completedCount: item.completed_count,
    progress01: item.total_assignees > 0 ? item.completed_count / item.total_assignees : 0,
    status: item.status as AssignmentStatus,
    createdAt: item.created_at ? new Date(item.created_at) : null,
  }));
});

const statusCounts = computed(() => {
  // Note: These counts are now based on current page only
  // For accurate counts across all pages, would need separate RPC calls
  const rows = assignmentRows.value;
  return {
    due: rows.filter((row) => row.status === 'due_soon' || row.status === 'upcoming').length,
    overdue: rows.filter((row) => row.status === 'overdue').length,
    completed: rows.filter((row) => row.status === 'completed').length,
  };
});

// Pagination computed (now uses server-side pagination)
const totalPages = computed(() => {
  return Math.ceil(totalAssignments.value / itemsPerPage.value);
});

// Server returns already paginated data - no need to slice again
const paginatedRows = computed(() => assignmentRows.value);

const visiblePageNumbers = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const delta = 2;
  
  const range: number[] = [];
  const rangeWithDots: (number | string)[] = [];
  
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
    range.push(i);
  }
  
  if (current - delta > 2) {
    rangeWithDots.push(1, '...');
  } else {
    rangeWithDots.push(1);
  }
  
  rangeWithDots.push(...range);
  
  if (current + delta < total - 1) {
    rangeWithDots.push('...', total);
  } else if (total > 1) {
    rangeWithDots.push(total);
  }
  
  return rangeWithDots;
});

// Combobox computed options
const groupComboOptions = computed<ComboOption[]>(() => {
  const options: ComboOption[] = [{ id: 'all', label: 'All' }];
  const query = groupQuery.value.toLowerCase();
  
  groups.value.forEach(({ group }) => {
    const label = group.name || 'Unnamed Group';
    if (!query || label.toLowerCase().includes(query)) {
      options.push({ id: group.id, label });
    }
  });
  
  return options;
});

const playerComboOptions = computed<ComboOption[]>(() => {
  const options: ComboOption[] = [{ id: 'all', label: 'All' }];
  const query = playerQuery.value.toLowerCase();
  
  members.value.forEach((member) => {
    const label = member.profile.name || member.profile.username || 'Unnamed';
    if (!query || label.toLowerCase().includes(query)) {
      options.push({ id: member.membership.user_id, label });
    }
  });
  
  return options;
});

const hasResults = computed(() => {
  return paginatedRows.value.length > 0;
});

// Pagination functions
function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    goToPage(currentPage.value + 1);
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    goToPage(currentPage.value - 1);
  }
}

function resetToFirstPage() {
  currentPage.value = 1;
}

const editInitial = computed(() => {
  if (!editingAssignment.value) return null;
  
  // Get first target for initial state
  const targets = editingAssignment.value.targets ?? [];
  const teamTarget = targets.find((t) => t.target_type === 'team');
  const groupTarget = targets.find((t) => t.target_type === 'group');
  const playerTarget = targets.find((t) => t.target_type === 'player');
  
  let targetType: 'team' | 'player' | 'group' = 'team';
  let targetId: string | null = null;
  
  if (teamTarget) {
    targetType = 'team';
  } else if (groupTarget) {
    targetType = 'group';
    targetId = groupTarget.target_id ?? null;
  } else if (playerTarget) {
    targetType = 'player';
    targetId = playerTarget.target_id ?? null;
  }
  
  return {
    title: editingAssignment.value.title ?? '',
    description: editingAssignment.value.description ?? null,
    dueAt: editingAssignment.value.due_at ?? null,
    targetType,
    targetId,
  };
});

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
}

async function confirmDeleteAssignment() {
  if (isDeleting.value) return;
  const ids = deleteAssignmentId.value ? [deleteAssignmentId.value] : [];
  if (ids.length === 0) return;
  await executeDelete(ids);
}

async function executeDelete(ids: string[]) {
  if (!canManage.value || ids.length === 0) return;
  isDeleting.value = true;
  deleteError.value = null;

  try {
    await Promise.all(ids.map((id: string) => assignmentsService.deleteAssignment(id)));
    
    toast({
      variant: 'success',
      message: `Deleted ${ids.length} assignment${ids.length === 1 ? '' : 's'}.`,
      durationMs: 2500,
    });
    
    closeDeleteModal(true);
    
    // Reload from server
    await loadAssignmentsPage();
    
    if (editingAssignment.value && ids.includes(editingAssignment.value.id)) closeEdit();
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete assignments.';
    toast({
      variant: 'error',
      message: deleteError.value ?? 'Failed to delete assignments.',
      durationMs: 3000,
    });
  } finally {
    isDeleting.value = false;
  }
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

    closeEdit();
    
    // Reload from server to get updated data
    await loadAssignmentsPage();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to update assignment.';
  }
}

function openAssignment(assignmentId: string) {
  if (!orgSlug.value) return;
  // Navigate to Assignment Detail page
  void router.push({
    name: 'AssignmentDetail',
    params: { slug: orgSlug.value, assignmentId },
  });
}

// Format relative date (e.g., "2 days ago")
function formatRelativeDate(date: Date | string | null): string {
  if (!date) return 'Unknown date';
  return formatRelativeTime(date) || 'Unknown date';
}

// Format due date text
function formatDueDateText(dueAt: Date | string | null): string {
  if (!dueAt) return '';
  
  const date = new Date(dueAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return 'Overdue';
  } else if (diffDays === 0) {
    return 'Due today';
  } else if (diffDays === 1) {
    return 'Due tomorrow';
  } else if (diffDays <= 7) {
    return `Due in ${diffDays} days`;
  } else {
    return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
}

// Get status badge label
function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'overdue':
      return 'Overdue';
    case 'due_soon':
      return 'Due Soon';
    default:
      return 'Active';
  }
}

// Get status badge color class
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'overdue':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'due_soon':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    default:
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }
}

// Get due date color class
function getDueDateClass(_status: string, dueAt: Date | string | null): string {
  if (!dueAt) return 'text-white/50';
  
  const date = new Date(dueAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return 'text-red-400';
  } else if (diffDays === 0) {
    return 'text-orange-400';
  }
  return 'text-white/50';
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

// Watch filters to reload data from server
watch([statusFilter, groupFilter, playerFilter, itemsPerPage], () => {
  currentPage.value = 1; // Reset to first page
  void loadAssignmentsPage(); // Reload from server
});

// Watch page changes to load new data
watch(currentPage, () => {
  void loadAssignmentsPage();
});

// Watch combobox selections to update filters (which triggers reload above)
watch(selectedGroupOption, (option) => {
  groupFilter.value = option.id;
});

watch(selectedPlayerOption, (option) => {
  playerFilter.value = option.id;
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
  () => [statusFilter.value, groupFilter.value, playerFilter.value],
  () => {
    if (!isSyncingFilters.value) {
      syncQueryFromFilters();
    }
  }
);

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

// no custom dropdown handlers needed

</script>

<template>
  <div class="container py-8 text-white">
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="text-3xl tracking-tight">Assignments</h1>
        <p class="text-sm text-white/50">Track what was assigned, who is behind, and what’s due soon.</p>
      </div>

      <!-- Filter Bar - MyRugby Style -->
      <div class="flex flex-col gap-3 text-sm mb-10">
        <!-- First Row: Show Count and Status Filters -->
        <div class="flex flex-wrap items-center gap-4">
          <!-- Show Count -->
          <div class="flex items-center gap-2">
            <span class="text-white/50">Show</span>
            <button
              type="button"
              @click="itemsPerPage = 5; resetToFirstPage()"
              class="transition px-2 py-0.5 rounded"
              :class="itemsPerPage === 5 ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              5
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="itemsPerPage = 10; resetToFirstPage()"
              class="transition px-2 py-0.5 rounded"
              :class="itemsPerPage === 10 ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              10
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="itemsPerPage = 20; resetToFirstPage()"
              class="transition px-2 py-0.5 rounded"
              :class="itemsPerPage === 20 ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              20
            </button>
          </div>

          <!-- Status Filters -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="statusFilter = 'all'"
              class="transition"
              :class="statusFilter === 'all' ? 'font-semibold text-white' : 'text-white/60'"
            >
              All
            </button>
            <span class="text-white/30">|</span>
            <button
              type="button"
              @click="statusFilter = 'due'"
              class="transition"
              :class="statusFilter === 'due' ? 'font-semibold text-white' : 'text-white/60'"
            >
              <span>Due</span>
              <span class="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px]">
                {{ statusCounts.due }}
              </span>
            </button>
            <span class="text-white/30">|</span>
            <button
              type="button"
              @click="statusFilter = 'overdue'"
              class="transition"
              :class="statusFilter === 'overdue' ? 'font-semibold text-white' : 'text-white/60'"
            >
              <span>Overdue</span>
              <span class="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px]">
                {{ statusCounts.overdue }}
              </span>
            </button>
            <span class="text-white/30">|</span>
            <button
              type="button"
              @click="statusFilter = 'completed'"
              class="transition"
              :class="statusFilter === 'completed' ? 'font-semibold text-white' : 'text-white/60'"
            >
              <span>Completed</span>
              <span class="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/10 px-1.5 text-[10px]">
                {{ statusCounts.completed }}
              </span>
            </button>
          </div>
        </div>

        <!-- Second Row: Target Comboboxes -->
        <div class="flex items-center gap-3">
          <!-- Group Combobox -->
          <Combobox v-model="selectedGroupOption" as="div" class="relative">
          <div class="relative">
            <ComboboxInput
              class="w-36 rounded bg-black/70 px-2 py-1 pr-8 text-left text-sm text-white ring-1 ring-white/10 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
              :displayValue="(option: any) => option?.label || 'All'"
              @change="groupQuery = $event.target.value"
              placeholder="Group..."
            />
            <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
              <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
            </ComboboxButton>
          </div>
          
          <transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ComboboxOptions class="absolute z-10 mt-1 max-h-60 w-full min-w-[200px] overflow-auto rounded-md border border-white/20 bg-gray-900 py-1 text-sm shadow-lg focus:outline-none">
              <ComboboxOption
                v-for="option in groupComboOptions"
                :key="option.id"
                :value="option"
                v-slot="{ active, selected }"
                as="template"
              >
                <li
                  class="relative cursor-pointer select-none py-2 pl-8 pr-4 transition"
                  :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                >
                  <span class="block truncate" :class="selected ? 'font-semibold' : 'font-normal'">
                    {{ option.label }}
                  </span>
                  <span v-if="selected" class="absolute inset-y-0 left-0 flex items-center pl-2 text-white">
                    <Icon icon="carbon:checkmark" class="h-4 w-4" />
                  </span>
                </li>
              </ComboboxOption>
            </ComboboxOptions>
          </transition>
        </Combobox>

        <!-- Player Combobox -->
        <Combobox v-model="selectedPlayerOption" as="div" class="relative">
          <div class="relative">
            <ComboboxInput
              class="w-36 rounded bg-black/70 px-2 py-1 pr-8 text-left text-sm text-white ring-1 ring-white/10 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
              :displayValue="(option: any) => option?.label || 'All'"
              @change="playerQuery = $event.target.value"
              placeholder="Player..."
            />
            <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
              <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
            </ComboboxButton>
          </div>
          
          <transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ComboboxOptions class="absolute left-0 z-10 mt-1 max-h-60 w-full min-w-[200px] overflow-auto rounded-md border border-white/20 bg-gray-900 py-1 text-sm shadow-lg focus:outline-none">
              <ComboboxOption
                v-for="option in playerComboOptions"
                :key="option.id"
                :value="option"
                v-slot="{ active, selected }"
                as="template"
              >
                <li
                  class="relative cursor-pointer select-none py-2 pl-8 pr-4 transition"
                  :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                >
                  <span class="block truncate" :class="selected ? 'font-semibold' : 'font-normal'">
                    {{ option.label }}
                  </span>
                  <span v-if="selected" class="absolute inset-y-0 left-0 flex items-center pl-2 text-white">
                    <Icon icon="carbon:checkmark" class="h-4 w-4" />
                  </span>
                </li>
              </ComboboxOption>
            </ComboboxOptions>
          </transition>
        </Combobox>
        </div>
      </div>
    </div>

    <div v-if="error" class="mt-6 text-sm text-red-200">
      {{ error }}
    </div>

    <div v-else-if="loading" class="mt-6 text-white/60">Loading assignments…</div>

    <div v-else-if="assignmentRows.length === 0" class="mt-6 text-white/50">
      No assignments yet.
    </div>

    <div v-else class="space-y-3">
      <div v-if="!hasResults" class="px-3 py-4 text-white/50">No assignments match your filters.</div>

      <div v-else class="space-y-3">
        <button
          v-for="row in paginatedRows"
          :key="row.id"
          @click="openAssignment(row.id)"
          class="w-full flex gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group cursor-pointer text-left"
        >
          <!-- Assignment info -->
          <div class="flex-1 min-w-0 flex flex-col gap-3">
            <!-- Row 1: Title (no org badge since page is org-scoped) -->
            <div class="flex items-start gap-2">
              <h3 class="font-semibold text-white group-hover:text-white/90 capitalize flex-1 min-w-0">
                {{ row.title }}
              </h3>
            </div>

            <!-- Row 2: Metadata -->
            <div class="flex items-center gap-2 text-xs text-white/50 flex-wrap">
              <span>{{ row.targetLabel || 'Team' }}</span>
              <span class="text-white/30">•</span>
              <span>{{ formatRelativeDate(row.createdAt ?? new Date()) }}</span>
            </div>

            <!-- Row 3: Progress & badges -->
            <div class="flex items-center gap-3 flex-wrap">
              <!-- Status badge -->
              <div
                :class="[
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border',
                  getStatusBadgeClass(row.status)
                ]"
              >
                <span>{{ getStatusLabel(row.status) }}</span>
              </div>

              <!-- Completion rate -->
              <div class="flex items-center gap-2">
                <div class="text-xs text-white/60">
                  {{ row.completedCount }} / {{ row.totalAssignees }}
                </div>
                
                <!-- Progress bar -->
                <div v-if="row.totalAssignees > 0" class="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    class="h-full bg-green-400 transition-all"
                    :style="{ width: `${Math.round(row.progress01 * 100)}%` }"
                  ></div>
                </div>
              </div>

              <!-- Due date -->
              <div 
                v-if="row.dueAt"
                :class="['text-xs', getDueDateClass(row.status, row.dueAt)]"
              >
                {{ formatDueDateText(row.dueAt) }}
              </div>
            </div>

            <!-- Description (if present) -->
            <div v-if="row.description" class="text-xs text-white/60 line-clamp-2">
              {{ row.description }}
            </div>
          </div>

          <!-- Right side: Actions menu + Arrow icon -->
          <div class="flex-shrink-0 flex items-center gap-2">
            <!-- Manager actions menu -->
            <AssignmentActionsMenu
              v-if="canManage"
              :can-edit="true"
              :can-delete="true"
              @edit="openEdit(row.id)"
              @delete="requestDelete(row.id)"
            />
          </div>
        </button>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 mt-6">
        <button
          type="button"
          @click="prevPage"
          :disabled="currentPage === 1"
          class="rounded px-3 py-1.5 text-sm transition"
          :class="currentPage === 1 ? 'text-white/30 cursor-not-allowed' : 'text-white/70 hover:bg-white/10'"
        >
          <Icon icon="carbon:chevron-left" class="h-4 w-4" />
        </button>

        <template v-for="(page, idx) in visiblePageNumbers" :key="idx">
          <span v-if="page === '...'" class="px-2 text-white/40">...</span>
          <button
            v-else
            type="button"
            @click="goToPage(page as number)"
            class="rounded px-3 py-1.5 text-sm transition"
            :class="currentPage === page ? 'bg-white/20 font-semibold text-white' : 'text-white/70 hover:bg-white/10'"
          >
            {{ page }}
          </button>
        </template>

        <button
          type="button"
          @click="nextPage"
          :disabled="currentPage === totalPages"
          class="rounded px-3 py-1.5 text-sm transition"
          :class="currentPage === totalPages ? 'text-white/30 cursor-not-allowed' : 'text-white/70 hover:bg-white/10'"
        >
          <Icon icon="carbon:chevron-right" class="h-4 w-4" />
        </button>
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

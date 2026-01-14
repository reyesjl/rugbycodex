<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { Icon } from '@iconify/vue';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { orgService } from '@/modules/orgs/services/orgServiceV2';
import type { OrgMember } from '@/modules/orgs/types';

import { groupsService } from '@/modules/groups/services/groupsService';
import type { OrgGroup } from '@/modules/groups/types';

import { assignmentsService } from '@/modules/assignments/services/assignmentsService';
import type { AssignmentTargetType, OrgAssignmentListItem } from '@/modules/assignments/types';

import CreateAssignmentModal from '@/modules/assignments/components/CreateAssignmentModal.vue';

const activeOrgStore = useActiveOrganizationStore();
const authStore = useAuthStore();
const { orgContext } = storeToRefs(activeOrgStore);

const orgId = computed(() => orgContext.value?.organization.id ?? null);

const canManage = computed(() => {
  if (authStore.isAdmin) return true;
  const role = orgContext.value?.membership?.role;
  return role === 'owner' || role === 'manager' || role === 'staff';
});

const loading = ref(false);
const error = ref<string | null>(null);

const members = ref<OrgMember[]>([]);
const groups = ref<OrgGroup[]>([]);
const assignments = ref<OrgAssignmentListItem[]>([]);

const showCreate = ref(false);

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
    groups.value = groupRows.map((g) => g.group);
    assignments.value = assignmentRows;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load assignments.';
    assignments.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  if (!orgId.value || !canManage.value) return;
  showCreate.value = true;
}

function closeCreate() {
  showCreate.value = false;
}

function formatDue(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

function formatTargets(item: OrgAssignmentListItem) {
  if (!item.targets || item.targets.length === 0) return '—';

  const parts = item.targets.map((t) => {
    if (t.target_type === 'team') return 'Team';
    if (t.target_type === 'player') return 'Player';
    if (t.target_type === 'group') return 'Group';
    return 'Target';
  });

  return Array.from(new Set(parts)).join(', ');
}

async function handleCreate(payload: {
  title: string;
  description: string | null;
  dueAt: string | null;
  targets: Array<{ type: AssignmentTargetType; id?: string | null }>;
}) {
  if (!orgId.value) return;

  try {
    await assignmentsService.createAssignment(orgId.value, payload);
    toast({ variant: 'success', message: 'Assignment created.', durationMs: 2500 });
    closeCreate();
    void load();
  } catch (e) {
    toast({ variant: 'error', message: e instanceof Error ? e.message : 'Failed to create assignment.', durationMs: 3500 });
  }
}

onMounted(() => {
  void load();
});

watch(orgId, (next, prev) => {
  if (next && next !== prev) void load();
});
</script>

<template>
  <div>
    <div class="container py-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-3">
        <div>
          <h1 class="text-white text-3xl tracking-tight">Assignments</h1>
        </div>

        <div v-if="canManage" class="flex flex-row flex-wrap gap-3">
          <button
            type="button"
            class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-green-500 bg-green-500/70 hover:bg-green-700/70 cursor-pointer text-xs transition disabled:opacity-50 w-fit"
            :disabled="loading || !orgId"
            @click="openCreate"
          >
            <Icon icon="carbon:add" width="15" height="15" />
            Create Assignment
          </button>
        </div>
      </div>

      <div v-if="error" class="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
        {{ error }}
      </div>

      <div v-if="loading" class="text-white/60">Loading assignments…</div>

      <div v-else-if="assignments.length === 0" class="text-sm text-gray-500">No assignments yet.</div>

      <div v-else class="space-y-3">
        <div
          v-for="a in assignments"
          :key="a.id"
          class="rounded-lg border border-white/10 bg-white/5 p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-white text-lg leading-snug">{{ a.title }}</div>
              <div v-if="a.description" class="mt-1 text-sm text-white/60">{{ a.description }}</div>

              <div class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/60">
                <div>
                  <span class="text-white/40">Targets:</span>
                  {{ formatTargets(a) }}
                </div>
                <div>
                  <span class="text-white/40">Clips:</span>
                  {{ a.clipCount }}
                </div>
                <div v-if="a.due_at">
                  <span class="text-white/40">Due:</span>
                  {{ formatDue(a.due_at) }}
                </div>
              </div>
            </div>

            <div class="text-xs text-white/40">Coach view</div>
          </div>
        </div>
      </div>
    </div>

    <CreateAssignmentModal
      v-if="showCreate && canManage"
      :members="members"
      :groups="groups"
      @close="closeCreate"
      @submit="handleCreate"
    />
  </div>
</template>

<style scoped>
/* intentionally empty */
</style>

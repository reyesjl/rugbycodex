<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { Icon } from '@iconify/vue';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { orgService } from '@/modules/orgs/services/orgServiceV2';
import type { OrgMember } from '@/modules/orgs/types';
import { groupsService } from '@/modules/groups/services/groupsService';
import type { OrgGroup } from '@/modules/groups/types';

import CreateGroupModal from '@/modules/groups/components/CreateGroupModal.vue';
import AddMemberToGroupModal from '@/modules/groups/components/AddMemberToGroupModal.vue';
import GroupMemberPill from '@/modules/groups/components/GroupMemberPill.vue';

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

const allMembers = ref<OrgMember[]>([]);
const groups = ref<Array<{ group: OrgGroup; members: OrgMember[] }>>([]);

const showCreateGroup = ref(false);
const showAddMemberToGroup = ref(false);
const activeGroupForAdd = ref<OrgGroup | null>(null);

async function load() {
  if (!orgId.value) return;

  loading.value = true;
  error.value = null;

  try {
    const [members, groupRows] = await Promise.all([
      orgService.listMembers(orgId.value),
      groupsService.getGroupsForOrg(orgId.value),
    ]);

    allMembers.value = members;

    const memberById = new Map<string, OrgMember>();
    for (const m of members) memberById.set(m.profile.id, m);

    groups.value = groupRows.map((row) => ({
      group: row.group,
      members: row.memberIds.map((id) => memberById.get(id)).filter(Boolean) as OrgMember[],
    }));
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load groups.';
    groups.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreateGroup() {
  if (!orgId.value || !canManage.value) return;
  showCreateGroup.value = true;
}

function closeCreateGroup() {
  showCreateGroup.value = false;
}

async function handleCreateGroup(payload: { name: string; description: string | null }) {
  if (!orgId.value) return;

  try {
    await groupsService.createGroup(orgId.value, payload);
    toast({ variant: 'success', message: `Group "${payload.name}" created.`, durationMs: 2500 });
    closeCreateGroup();
    void load();
  } catch (e) {
    toast({ variant: 'error', message: e instanceof Error ? e.message : 'Failed to create group.', durationMs: 3500 });
  }
}

function openAddMember(group: OrgGroup) {
  if (!canManage.value) return;
  activeGroupForAdd.value = group;
  showAddMemberToGroup.value = true;
}

function closeAddMember() {
  showAddMemberToGroup.value = false;
  activeGroupForAdd.value = null;
}

async function handleAddMember(payload: { userId: string }) {
  if (!activeGroupForAdd.value) return;

  try {
    await groupsService.addMemberToGroup(activeGroupForAdd.value.id, payload.userId);
    toast({ variant: 'success', message: 'Member added to group.', durationMs: 2000 });
    closeAddMember();
    void load();
  } catch (e) {
    toast({ variant: 'error', message: e instanceof Error ? e.message : 'Failed to add member to group.', durationMs: 3500 });
  }
}

async function removeMember(groupId: string, userId: string) {
  if (!canManage.value) return;

  try {
    await groupsService.removeMemberFromGroup(groupId, userId);
    toast({ variant: 'success', message: 'Member removed from group.', durationMs: 2000 });
    void load();
  } catch (e) {
    toast({ variant: 'error', message: e instanceof Error ? e.message : 'Failed to remove member.', durationMs: 3500 });
  }
}

function displayName(m: OrgMember) {
  return m.profile.username || m.profile.name;
}

function sortMembers(a: OrgMember, b: OrgMember) {
  return displayName(a).toLowerCase().localeCompare(displayName(b).toLowerCase());
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
          <h1 class="text-white text-3xl tracking-tight">Groups</h1>
        </div>

        <div v-if="canManage" class="flex flex-row flex-wrap gap-3">
          <button
            type="button"
            class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-green-500 bg-green-500/70 hover:bg-green-700/70 cursor-pointer text-xs transition disabled:opacity-50 w-fit"
            :disabled="loading || !orgId"
            @click="openCreateGroup"
          >
            <Icon icon="carbon:add" width="15" height="15" />
            Create Group
          </button>
        </div>
      </div>

      <div v-if="error" class="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
        {{ error }}
      </div>

      <div v-if="loading" class="text-white/60">Loading groups…</div>

      <div v-else-if="groups.length === 0" class="text-sm text-gray-500">No groups found.</div>

      <div v-else class="space-y-8">
        <section
          v-for="row in groups"
          :key="row.group.id"
          class="border-t border-white/20 pt-4"
        >
          <div class="flex flex-col md:flex-row md:items-start justify-between gap-3">
            <div>
              <h2 class="text-white text-xl tracking-tight">{{ row.group.name }}</h2>
              <p v-if="row.group.description" class="text-sm text-gray-400 mt-1">{{ row.group.description }}</p>
            </div>

            <div v-if="canManage">
              <button
                type="button"
                class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-sky-500 bg-sky-500/70 hover:bg-sky-700/70 cursor-pointer text-xs transition w-fit"
                @click="openAddMember(row.group)"
              >
                <Icon icon="carbon:user-follow" width="15" height="15" />
                Add Member to Group
              </button>
            </div>
          </div>

          <div v-if="row.members.length" class="mt-4 flex flex-wrap gap-2">
            <GroupMemberPill
              v-for="m in [...row.members].sort(sortMembers)"
              :key="m.profile.id"
              :member="m"
              :can-manage="canManage"
              @remove="removeMember(row.group.id, m.profile.id)"
            />
          </div>
          <p v-else class="mt-4 text-sm text-gray-500">No members in this group yet.</p>
        </section>
      </div>
    </div>

    <CreateGroupModal v-if="showCreateGroup && canManage" @close="closeCreateGroup" @submit="handleCreateGroup" />

    <AddMemberToGroupModal
      v-if="showAddMemberToGroup && canManage && activeGroupForAdd"
      :members="allMembers"
      :group-name="activeGroupForAdd.name"
      @close="closeAddMember"
      @submit="handleAddMember"
    />
  </div>
</template>

<style scoped>
/* intentionally empty */
</style>

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
import MemberPill from '@/modules/orgs/components/MemberPill.vue';
import GroupMemberActionMenu from '@/modules/groups/components/GroupMemberActionMenu.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';

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
const showDeleteConfirm = ref(false);
const groupToDelete = ref<OrgGroup | null>(null);
const isDeleting = ref(false);

// Computed stats
const totalGroups = computed(() => groups.value.length);

const groupBreakdown = computed(() => {
  if (groups.value.length === 0) return '';
  
  const parts = groups.value.map(g => {
    const count = g.members.length;
    return `${count} ${g.group.name}`;
  });
  
  return parts.join(' | ');
});

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

function openAddMember() {
  if (!canManage.value) return;
  showAddMemberToGroup.value = true;
}

function closeAddMember() {
  showAddMemberToGroup.value = false;
}

async function handleAddMember(payload: { groupId: string; userId: string }) {
  try {
    await groupsService.addMemberToGroup(payload.groupId, payload.userId);
    toast({ variant: 'success', message: 'Member added to group.', durationMs: 2000 });
    closeAddMember();
    void load();
  } catch (e) {
    toast({ variant: 'error', message: e instanceof Error ? e.message : 'Failed to add member to group.', durationMs: 3500 });
  }
}

async function handleRemoveMember(payload: { groupId: string; userId: string }) {
  if (!canManage.value) return;

  try {
    await groupsService.removeMemberFromGroup(payload.groupId, payload.userId);
    toast({ variant: 'success', message: 'Member removed from group.', durationMs: 2000 });
    void load();
  } catch (e) {
    toast({ variant: 'error', message: e instanceof Error ? e.message : 'Failed to remove member.', durationMs: 3500 });
  }
}

function displayName(m: OrgMember) {
  return m.profile.name || m.profile.username || 'Unknown';
}

function sortMembers(a: OrgMember, b: OrgMember) {
  return displayName(a).toLowerCase().localeCompare(displayName(b).toLowerCase());
}

function openDeleteConfirm(group: OrgGroup) {
  if (!canManage.value) return;
  groupToDelete.value = group;
  showDeleteConfirm.value = true;
}

function closeDeleteConfirm() {
  showDeleteConfirm.value = false;
  groupToDelete.value = null;
}

async function handleDeleteGroup() {
  if (!groupToDelete.value) return;
  
  isDeleting.value = true;
  
  try {
    await groupsService.deleteGroup(groupToDelete.value.id);
    toast({ 
      variant: 'success', 
      message: `Group "${groupToDelete.value.name}" deleted.`, 
      durationMs: 2500 
    });
    closeDeleteConfirm();
    void load();
  } catch (e) {
    toast({ 
      variant: 'error', 
      message: e instanceof Error ? e.message : 'Failed to delete group.', 
      durationMs: 3500 
    });
  } finally {
    isDeleting.value = false;
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
          <h1 class="text-white text-3xl tracking-tight">
            {{ totalGroups }} {{ totalGroups === 1 ? 'Group' : 'Groups' }}
          </h1>
          <p v-if="groupBreakdown" class="text-gray-400 text-sm mt-1">
            {{ groupBreakdown }}
          </p>
        </div>

        <div v-if="canManage" class="flex flex-row flex-wrap gap-3">
          <button
            type="button"
            class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-sky-500 bg-sky-500/70 hover:bg-sky-700/70 cursor-pointer text-xs transition disabled:opacity-50 w-fit"
            :disabled="loading || !orgId || groups.length === 0"
            @click="openAddMember"
          >
            <Icon icon="carbon:user-follow" width="15" height="15" />
            Add Member to Group
          </button>
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

      <div v-else-if="groups.length === 0" class="text-sm text-gray-500">Create player groups to assign clips and media segments to the right people.
Perfect for units like forwards, backs, or position groups.</div>

      <div v-else class="space-y-6 border-t border-white/20 pt-4">
        <section
          v-for="row in groups"
          :key="row.group.id"
          class="space-y-3"
        >
          <div class="flex items-start justify-between">
            <h3 class="text-white text-lg font-medium flex items-center gap-2">
              <Icon icon="carbon:group" class="text-sky-400" width="20" height="20" />
              {{ row.group.name }}
              <span class="text-sm text-gray-400 font-normal">
                ({{ row.members.length }})
              </span>
            </h3>
            
            <!-- Delete button -->
            <button
              v-if="canManage"
              type="button"
              class="flex items-center justify-center p-1.5 rounded hover:bg-red-500/20 transition group"
              title="Delete group"
              @click="openDeleteConfirm(row.group)"
            >
              <Icon 
                icon="carbon:trash-can" 
                class="text-gray-400 group-hover:text-red-400 transition" 
                width="18" 
                height="18" 
              />
            </button>
          </div>
          
          <p v-if="row.group.description" class="text-sm text-gray-400 md:pl-7">
            {{ row.group.description }}
          </p>

          <div v-if="row.members.length" class="flex flex-col md:flex-row md:flex-wrap gap-2 md:pl-7">
            <MemberPill 
              v-for="m in [...row.members].sort(sortMembers)" 
              :key="m.profile.id" 
              :member="m"
              :show-role="false"
            >
              <template #actions>
                <GroupMemberActionMenu
                  v-if="canManage"
                  :member="m"
                  :group-id="row.group.id"
                  :group-name="row.group.name"
                  @remove="handleRemoveMember"
                />
              </template>
            </MemberPill>
          </div>
          <p v-else class="text-sm text-gray-500 md:pl-7">No members in this group yet.</p>
        </section>
      </div>
    </div>

    <CreateGroupModal v-if="showCreateGroup && canManage" @close="closeCreateGroup" @submit="handleCreateGroup" />

    <AddMemberToGroupModal
      v-if="showAddMemberToGroup && canManage"
      :members="allMembers"
      :groups="groups"
      @close="closeAddMember"
      @submit="handleAddMember"
    />

    <ConfirmDeleteModal
      v-if="showDeleteConfirm && groupToDelete"
      :show="showDeleteConfirm"
      popup-title="Delete Group"
      :item-name="groupToDelete.name"
      :is-deleting="isDeleting"
      @cancel="closeDeleteConfirm"
      @confirm="handleDeleteGroup"
    />
  </div>
</template>

<style scoped>
/* intentionally empty */
</style>

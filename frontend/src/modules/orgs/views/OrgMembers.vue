<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { orgService } from "@/modules/orgs/services/orgServiceV2";
import { useActiveOrganizationStore } from "@/modules/orgs/stores/useActiveOrganizationStore";
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import type { OrgMember } from "@/modules/orgs/types";
import type { OrgJoinCode } from "@/modules/orgs/types";
import AddMemberModal from '@/modules/orgs/components/AddMemberModal.vue';
import MemberPill from '@/modules/orgs/components/MemberPill.vue';
import MembersActionBar from '@/modules/orgs/components/MembersActionBar.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import { Icon } from "@iconify/vue";
import { toast } from '@/lib/toast';

// Role hierarchy for client-side validation
const ROLE_RANK = {
  member: 0,
  staff: 1,
  manager: 2,
  owner: 3,
} as const;

const activeOrgStore = useActiveOrganizationStore();
const authStore = useAuthStore();

const orgId = computed(() => activeOrgStore.orgContext?.organization.id ?? null);

const canManage = computed(() => {
  if (authStore.isAdmin) return true;
  const role = activeOrgStore.orgContext?.membership?.role;
  return role === 'owner' || role === 'manager' || role === 'staff';
});

const role = computed(() => activeOrgStore.orgContext?.membership?.role ?? 'member');

const loading = ref(false);
const error = ref<string | null>(null);
const members = ref<OrgMember[]>([]);
const showAddMember = ref(false);
const selectedMemberIds = ref<Set<string>>(new Set());
const showConfirmRemove = ref(false);
const deleteError = ref<string | null>(null);
const isDeleting = ref(false);
const joinCodeData = ref<OrgJoinCode | null>(null);
const loadingJoinCode = ref(false);
const joinCodeError = ref<string | null>(null);

const isJoinCodeExpired = computed(() => {
  if (!joinCodeData.value?.joinCodeSetAt) return true;
  const setAt = new Date(joinCodeData.value.joinCodeSetAt);
  const now = new Date();
  const hoursSinceSet = (now.getTime() - setAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceSet >= 24;
});

function openAddMember() {
  if (!orgId.value) return;
  if (!canManage.value) return;
  showAddMember.value = true;
}

function closeAddMember() {
  showAddMember.value = false;
}

async function handleAddMember(payload: { username: string; role: 'member' | 'staff' | 'manager' | 'owner' }) {
  if (!orgId.value) return;

  try {
    await orgService.addMemberByUsername(orgId.value, payload.username, payload.role);

    toast({
      variant: 'success',
      message: `Member ${payload.username} added as ${payload.role}.`,
      durationMs: 2500,
    });

    closeAddMember();
    void load();
  } catch (e) {
    toast({
      variant: 'error',
      message: e instanceof Error ? e.message : 'Failed to add member.',
      durationMs: 3500,
    });
  }
}

function toggleMemberSelection(memberId: string) {
  if (!canManage.value) return;
  if (selectedMemberIds.value.has(memberId)) {
    selectedMemberIds.value.delete(memberId);
  } else {
    selectedMemberIds.value.add(memberId);
  }
}

function isSelected(memberId: string) {
  return selectedMemberIds.value.has(memberId);
}

const hasSelection = computed(() => selectedMemberIds.value.size > 0);

async function handlePromote() {
  if (!orgId.value) return;

  const myRole = role.value as 'member' | 'staff' | 'manager' | 'owner';
  const myRank = ROLE_RANK[myRole];

  // Client-side validation: filter members we can actually promote
  const promotable = members.value
    .filter(m => selectedMemberIds.value.has(m.profile.id))
    .filter(m => {
      const currentRank = ROLE_RANK[m.membership.role as keyof typeof ROLE_RANK];
      const nextRank = currentRank + 1;

      // Can't promote if already at max
      if (m.membership.role === 'owner') return false;

      // Can't promote if result would be higher than our own role
      if (nextRank > myRank) return false;

      return true;
    });

  if (promotable.length === 0) {
    toast({
      variant: 'error',
      message: 'Cannot promote selected members: insufficient permissions or already at maximum role.',
      durationMs: 3000,
    });
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    await Promise.all(
      promotable.map((m) => {
        let newRole: 'member' | 'staff' | 'manager' | 'owner';
        switch (m.membership.role) {
          case 'member':
            newRole = 'staff';
            break;
          case 'staff':
            newRole = 'manager';
            break;
          case 'manager':
            newRole = 'owner';
            break;
          case 'viewer':
            newRole = 'member';
            break;
          default:
            newRole = 'member';
        }
        return orgService.changeMemberRole(orgId.value!, m.profile.id, newRole);
      })
    );

    toast({
      variant: 'success',
      message: `${promotable.length} member${promotable.length === 1 ? '' : 's'} promoted.`,
      durationMs: 2500,
    });

    selectedMemberIds.value.clear();
    void load();
  } catch (e) {
    toast({
      variant: 'error',
      message: e instanceof Error ? e.message : 'Failed to promote members.',
      durationMs: 3500,
    });
  } finally {
    loading.value = false;
  }
}

async function handleDemote() {
  if (!orgId.value) return;

  const myRole = role.value as 'member' | 'staff' | 'manager' | 'owner';
  const myRank = ROLE_RANK[myRole];

  // Client-side validation: filter members we can actually demote
  const demotable = members.value
    .filter(m => selectedMemberIds.value.has(m.profile.id))
    .filter(m => {
      const currentRank = ROLE_RANK[m.membership.role as keyof typeof ROLE_RANK];

      // Can't demote if already at min
      if (m.membership.role === 'member') return false;

      // Can't demote if their current rank is higher than ours
      if (currentRank > myRank) return false;

      return true;
    });

  if (demotable.length === 0) {
    toast({
      variant: 'error',
      message: 'Cannot demote selected members: insufficient permissions or already at minimum role.',
      durationMs: 3000,
    });
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    await Promise.all(
      demotable.map((m) => {
        let newRole: 'member' | 'staff' | 'manager' | 'owner';
        switch (m.membership.role) {
          case 'owner':
            newRole = 'manager';
            break;
          case 'manager':
            newRole = 'staff';
            break;
          case 'staff':
            newRole = 'member';
            break;
          default:
            newRole = 'member';
        }
        return orgService.changeMemberRole(orgId.value!, m.profile.id, newRole);
      })
    );

    toast({
      variant: 'success',
      message: `${demotable.length} member${demotable.length === 1 ? '' : 's'} demoted.`,
      durationMs: 2500,
    });

    selectedMemberIds.value.clear();
    void load();
  } catch (e) {
    toast({
      variant: 'error',
      message: e instanceof Error ? e.message : 'Failed to demote members.',
      durationMs: 3500,
    });
  } finally {
    loading.value = false;
  }
}

function openConfirmRemove() {
  if (!hasSelection.value) return;
  deleteError.value = null;
  showConfirmRemove.value = true;
}

function closeConfirmRemove() {
  if (isDeleting.value) return;
  showConfirmRemove.value = false;
  deleteError.value = null;
}

async function confirmRemoveMembers() {
  if (!orgId.value) return;

  const selected = members.value.filter(m => selectedMemberIds.value.has(m.profile.id));

  if (selected.length === 0) return;

  isDeleting.value = true;
  deleteError.value = null;

  try {
    await Promise.all(
      selected.map((m) =>
        orgService.removeMember(orgId.value!, m.profile.id)
      )
    );

    // Refresh list
    members.value = members.value.filter(
      (m) => !selectedMemberIds.value.has(m.profile.id)
    );

    const removedCount = selected.length;
    selectedMemberIds.value.clear();
    showConfirmRemove.value = false;

    toast({
      variant: 'success',
      message: `${removedCount} member${removedCount === 1 ? '' : 's'} removed.`,
      durationMs: 2500,
    });
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to remove members.';
  } finally {
    isDeleting.value = false;
  }
}

function sortByName(a: OrgMember, b: OrgMember) {
  const an = (a.profile.name ?? a.profile.username ?? "").toLowerCase();
  const bn = (b.profile.name ?? b.profile.username ?? "").toLowerCase();
  return an.localeCompare(bn);
}

function roleRank(role: string) {
  // desired order: owners → managers → staff → members
  switch (role) {
    case "owner":
      return 0;
    case "manager":
      return 1;
    case "staff":
      return 2;
    case "member":
      return 3;
    default:
      return 4;
  }
}

const sortedMembers = computed(() => {
  return [...members.value].sort((a, b) => {
    const ar = roleRank(a.membership.role);
    const br = roleRank(b.membership.role);
    if (ar !== br) return ar - br;
    return sortByName(a, b);
  });
});

async function load() {
  if (!orgId.value) return;

  loading.value = true;
  error.value = null;

  try {
    members.value = await orgService.listMembers(orgId.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load members.";
    members.value = [];
  } finally {
    loading.value = false;
  }

  // Fetch join code only if user has management permissions
  if (canManage.value) {
    void loadJoinCode();
  }
}

async function loadJoinCode() {
  if (!orgId.value || !canManage.value) return;

  loadingJoinCode.value = true;
  joinCodeError.value = null;

  try {
    joinCodeData.value = await orgService.getJoinCode(orgId.value);
  } catch (e) {
    joinCodeError.value = e instanceof Error ? e.message : "Failed to load join code.";
    joinCodeData.value = null;
  } finally {
    loadingJoinCode.value = false;
  }
}

async function copyJoinCode() {
  if (!joinCodeData.value?.joinCode) return;

  try {
    await navigator.clipboard.writeText(joinCodeData.value.joinCode);
    toast({
      variant: 'success',
      message: 'Join code copied to clipboard.',
      durationMs: 2000,
    });
  } catch (e) {
    toast({
      variant: 'error',
      message: 'Failed to copy join code.',
      durationMs: 2500,
    });
  }
}
async function refreshJoinCode() {
  if (!orgId.value) return;

  loadingJoinCode.value = true;
  joinCodeError.value = null;

  try {
    // Call service to refresh the join code
    joinCodeData.value = await orgService.refreshJoinCode(orgId.value);

    toast({
      variant: 'success',
      message: 'Join code refreshed successfully.',
      durationMs: 2000,
    });
  } catch (e) {
    toast({
      variant: 'error',
      message: e instanceof Error ? e.message : 'Failed to refresh join code.',
      durationMs: 3500,
    });
  } finally {
    loadingJoinCode.value = false;
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
          <h1 class="text-white text-3xl tracking-tight">Members</h1>
        </div>
        <div v-if="canManage" class="flex flex-row flex-wrap gap-3">
          <!-- Refresh button for expired code -->
          <button
            v-if="isJoinCodeExpired && joinCodeData"
            type="button"
            class="flex gap-2 items-center text-white rounded-lg px-2 py-1 border border-red-500 bg-red-500/70 hover:bg-red-700/70 text-xs cursor-pointer transition disabled:opacity-50 w-fit"
            :disabled="loadingJoinCode"
            @click="refreshJoinCode">
            <Icon icon="carbon:renew" width="15" height="15" />
            <div>Refresh expired code</div>
          </button>
          <!-- Copy button for valid code -->
          <button
            v-else
            type="button"
            class="flex gap-2 items-center text-white rounded-lg px-2 py-1 border border-sky-500 bg-sky-500/70 hover:bg-sky-700/70 text-xs cursor-pointer transition disabled:opacity-50 w-fit"
            :disabled="!joinCodeData || loadingJoinCode"
            @click="copyJoinCode">
            <Icon icon="carbon:copy" width="15" height="15" />
            <div>Copy invite code</div>
          </button>
          <button
            type="button"
            class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-green-500 bg-green-500/70 hover:bg-green-700/70 cursor-pointer text-xs transition disabled:opacity-50 w-fit"
            :disabled="loading || !orgId"
            @click="openAddMember">
            <Icon icon="carbon:add" width="15" height="15" />
            Add Member
          </button>
        </div>
      </div>

      <!-- Action bar with Add / Promote / Demote / Remove controls -->
      <MembersActionBar :can-manage="canManage" :has-selection="hasSelection" :selected-count="selectedMemberIds.size"
        :loading="loading" :org-id="orgId" @promote="handlePromote" @demote="handleDemote"
        @remove="openConfirmRemove" />

      <div v-if="error" class="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
        {{ error }}
      </div>

      <div v-if="sortedMembers.length" class="flex flex-wrap gap-2 border-t border-white/20 pt-4">
        <MemberPill v-for="m in sortedMembers" :key="m.profile.id" :member="m" :selected="isSelected(m.profile.id)"
          :can-manage="canManage" @toggle="toggleMemberSelection(m.profile.id)" />
      </div>

      <p v-else class="text-sm text-gray-500">No members found.</p>
    </div>

    <AddMemberModal v-if="showAddMember && canManage" @close="closeAddMember" @submit="handleAddMember" />

    <ConfirmDeleteModal :show="showConfirmRemove"
      :item-name="`${selectedMemberIds.size} member${selectedMemberIds.size === 1 ? '' : 's'}`"
      popup-title="Remove Members" :is-deleting="isDeleting" :error="deleteError" @confirm="confirmRemoveMembers"
      @cancel="closeConfirmRemove" @close="closeConfirmRemove" />
  </div>
</template>

<style scoped>
/* intentionally empty: swiss-style = let spacing + type do the work */
</style>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { orgService } from "@/modules/orgs/services/orgServiceV2";
import { useActiveOrganizationStore } from "@/modules/orgs/stores/useActiveOrganizationStore";
import { useAuthStore } from '@/auth/stores/useAuthStore';
import type { OrgMember } from "@/modules/orgs/types";
import AddMemberModal from '@/modules/orgs/components/AddMemberModal.vue';
import MemberPill from '@/modules/orgs/components/MemberPill.vue';
import MembersActionBar from '@/modules/orgs/components/MembersActionBar.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import { toast } from '@/lib/toast';

const activeOrgStore = useActiveOrganizationStore();
const authStore = useAuthStore();

const orgId = computed(() => activeOrgStore.orgContext?.organization.id ?? null);

const canManage = computed(() => {
  if (authStore.isAdmin) return true;
  const role = activeOrgStore.orgContext?.membership?.role;
  return role === 'owner' || role === 'manager' || role === 'staff';
});

const loading = ref(false);
const error = ref<string | null>(null);
const members = ref<OrgMember[]>([]);
const showAddMember = ref(false);
const selectedMemberIds = ref<Set<string>>(new Set());
const showConfirmRemove = ref(false);
const deleteError = ref<string | null>(null);
const isDeleting = ref(false);

function openAddMember() {
  if (!orgId.value) return;
  if (!canManage.value) return;
  showAddMember.value = true;
}

function closeAddMember() {
  showAddMember.value = false;
}

function handleAddMember(payload: { username: string; role: 'member' | 'staff' | 'manager' | 'owner' }) {
  // Stub: backend logic to be implemented
  console.log('Add member:', payload);
  
  // TODO: Remove stub and implement actual API call
  toast({
    variant: 'success',
    message: `Member ${payload.username} added as ${payload.role}.`,
    durationMs: 2500,
  });
  
  closeAddMember();
  // After real implementation: reload members list
  // void load();
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

function handlePromote() {
  const selected = members.value.filter(m => selectedMemberIds.value.has(m.profile.id));
  console.log('Promote members:', selected.map(m => ({ id: m.profile.id, username: displayName(m), role: m.membership.role })));
  
  // Stub: backend logic to be implemented
  // TODO: Implement actual API call for promotion
  toast({
    variant: 'error',
    message: 'Promote feature not yet implemented.',
    durationMs: 3000,
  });
  
  // After implementation:
  // toast({
  //   variant: 'success',
  //   message: `${selected.length} member${selected.length === 1 ? '' : 's'} promoted.`,
  //   durationMs: 2500,
  // });
  // selectedMemberIds.value.clear();
  // void load();
}

function handleDemote() {
  const selected = members.value.filter(m => selectedMemberIds.value.has(m.profile.id));
  console.log('Demote members:', selected.map(m => ({ id: m.profile.id, username: displayName(m), role: m.membership.role })));
  
  // Stub: backend logic to be implemented
  // TODO: Implement actual API call for demotion
  toast({
    variant: 'error',
    message: 'Demote feature not yet implemented.',
    durationMs: 3000,
  });
  
  // After implementation:
  // toast({
  //   variant: 'success',
  //   message: `${selected.length} member${selected.length === 1 ? '' : 's'} demoted.`,
  //   durationMs: 2500,
  // });
  // selectedMemberIds.value.clear();
  // void load();
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
  // desired order: owners → staff → managers → members
  switch (role) {
    case "owner":
      return 0;
    case "staff":
      return 1;
    case "manager":
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

function displayName(m: OrgMember) {
  return m.profile.username || m.profile.name;
}

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
      <div class="mb-6 flex md:flex-row flex-col md:items-end justify-between gap-4">
        <div>
          <h1 class="text-white text-3xl tracking-tight">Members</h1>
        </div>
      </div>

      <!-- Action bar with Add / Promote / Demote / Remove controls -->
      <MembersActionBar
        :can-manage="canManage"
        :has-selection="hasSelection"
        :selected-count="selectedMemberIds.size"
        :loading="loading"
        :org-id="orgId"
        @add="openAddMember"
        @promote="handlePromote"
        @demote="handleDemote"
        @remove="openConfirmRemove"
      />

      <div v-if="error" class="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
        {{ error }}
      </div>

      <div v-if="sortedMembers.length" class="flex flex-wrap gap-2">
        <MemberPill
          v-for="m in sortedMembers"
          :key="m.profile.id"
          :member="m"
          :selected="isSelected(m.profile.id)"
          :can-manage="canManage"
          @toggle="toggleMemberSelection(m.profile.id)"
        />
      </div>

      <p v-else class="text-sm text-gray-500">No members found.</p>
    </div>

    <AddMemberModal v-if="showAddMember && canManage" @close="closeAddMember" @submit="handleAddMember" />
    
    <ConfirmDeleteModal
      :show="showConfirmRemove"
      :item-name="`${selectedMemberIds.size} member${selectedMemberIds.size === 1 ? '' : 's'}`"
      popup-title="Remove Members"
      :is-deleting="isDeleting"
      :error="deleteError"
      @confirm="confirmRemoveMembers"
      @cancel="closeConfirmRemove"
      @close="closeConfirmRemove"
    />
  </div>
</template>

<style scoped>
/* intentionally empty: swiss-style = let spacing + type do the work */
</style>

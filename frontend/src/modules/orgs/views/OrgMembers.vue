<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { orgService } from "@/modules/orgs/services/orgServiceV2";
import { useActiveOrganizationStore } from "@/modules/orgs/stores/useActiveOrganizationStore";
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import type { OrgMember, OrgRole } from "@/modules/orgs/types";
import type { OrgJoinCode } from "@/modules/orgs/types";
import AddMemberModal from '@/modules/orgs/components/AddMemberModal.vue';
import MemberPill from '@/modules/orgs/components/MemberPill.vue';
import MemberActionMenu from '@/modules/orgs/components/MemberActionMenu.vue';
import { Icon } from "@iconify/vue";
import { toast } from '@/lib/toast';

const activeOrgStore = useActiveOrganizationStore();
const authStore = useAuthStore();

const orgId = computed(() => activeOrgStore.orgContext?.organization.id ?? null);

const canManage = computed(() => {
  if (authStore.isAdmin) return true;
  const role = activeOrgStore.orgContext?.membership?.role;
  return role === 'owner' || role === 'manager' || role === 'staff';
});

const role = computed(() => (activeOrgStore.orgContext?.membership?.role ?? 'member') as 'owner' | 'manager' | 'staff' | 'member');

const loading = ref(false);
const error = ref<string | null>(null);
const members = ref<OrgMember[]>([]);
const showAddMember = ref(false);
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

// Individual member action handlers
async function handlePromoteMember(payload: { memberId: string; newRole: OrgRole }) {
  if (!orgId.value) return;

  loading.value = true;
  error.value = null;

  try {
    await orgService.changeMemberRole(orgId.value, payload.memberId, payload.newRole);

    toast({
      variant: 'success',
      message: `Member promoted to ${payload.newRole}.`,
      durationMs: 2500,
    });

    void load();
  } catch (e) {
    toast({
      variant: 'error',
      message: e instanceof Error ? e.message : 'Failed to promote member.',
      durationMs: 3500,
    });
  } finally {
    loading.value = false;
  }
}

async function handleDemoteMember(payload: { memberId: string; newRole: OrgRole }) {
  if (!orgId.value) return;

  loading.value = true;
  error.value = null;

  try {
    await orgService.changeMemberRole(orgId.value, payload.memberId, payload.newRole);

    toast({
      variant: 'success',
      message: `Member demoted to ${payload.newRole}.`,
      durationMs: 2500,
    });

    void load();
  } catch (e) {
    toast({
      variant: 'error',
      message: e instanceof Error ? e.message : 'Failed to demote member.',
      durationMs: 3500,
    });
  } finally {
    loading.value = false;
  }
}

async function handleRemoveMember(payload: { memberId: string }) {
  if (!orgId.value) return;

  loading.value = true;
  error.value = null;

  try {
    await orgService.removeMember(orgId.value, payload.memberId);

    toast({
      variant: 'success',
      message: 'Member removed from organization.',
      durationMs: 2500,
    });

    void load();
  } catch (e) {
    toast({
      variant: 'error',
      message: e instanceof Error ? e.message : 'Failed to remove member.',
      durationMs: 3500,
    });
  } finally {
    loading.value = false;
  }
}

function sortByName(a: OrgMember, b: OrgMember) {
  const an = (a.profile.name ?? a.profile.username ?? "").toLowerCase();
  const bn = (b.profile.name ?? b.profile.username ?? "").toLowerCase();
  return an.localeCompare(bn);
}

// Total member count
const totalMembers = computed(() => members.value.length);

// Members grouped by role (alphabetically sorted within each)
const membersByRole = computed(() => {
  const owners = members.value
    .filter(m => m.membership.role === 'owner')
    .sort(sortByName);
  
  const managers = members.value
    .filter(m => m.membership.role === 'manager')
    .sort(sortByName);
  
  const staff = members.value
    .filter(m => m.membership.role === 'staff')
    .sort(sortByName);
  
  const regularMembers = members.value
    .filter(m => m.membership.role === 'member')
    .sort(sortByName);
  
  return { 
    owners, 
    managers, 
    staff, 
    members: regularMembers 
  };
});

// Role breakdown text (e.g., "2 owners | 3 managers | 5 staff | 14 members")
const roleBreakdown = computed(() => {
  const { owners, managers, staff, members: regularMembers } = membersByRole.value;
  const parts = [];
  
  if (owners.length > 0) {
    parts.push(`${owners.length} owner${owners.length > 1 ? 's' : ''}`);
  }
  if (managers.length > 0) {
    parts.push(`${managers.length} manager${managers.length > 1 ? 's' : ''}`);
  }
  if (staff.length > 0) {
    parts.push(`${staff.length} staff`);
  }
  if (regularMembers.length > 0) {
    parts.push(`${regularMembers.length} member${regularMembers.length > 1 ? 's' : ''}`);
  }
  
  return parts.join(' | ');
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
          <h1 class="text-white text-3xl tracking-tight">
            {{ totalMembers }} {{ totalMembers === 1 ? 'Member' : 'Members' }}
          </h1>
          <p class="text-gray-400 text-sm mt-1">
            {{ roleBreakdown }}
          </p>
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

      <div v-if="error" class="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
        {{ error }}
      </div>

      <div v-if="totalMembers > 0" class="space-y-6 border-t border-white/20 pt-4">
        <!-- Owners Section -->
        <div v-if="membersByRole.owners.length > 0" class="space-y-3">
          <h3 class="text-white text-lg font-medium flex items-center gap-2">
            <Icon icon="carbon:user-filled" class="text-yellow-400" width="20" height="20" />
            Owners
            <span class="text-sm text-gray-400 font-normal">
              ({{ membersByRole.owners.length }})
            </span>
          </h3>
          <div class="flex flex-col md:flex-row md:flex-wrap gap-2 md:pl-7">
            <MemberPill 
              v-for="m in membersByRole.owners" 
              :key="m.profile.id" 
              :member="m"
              :show-role="false"
            >
              <template #actions>
                <MemberActionMenu
                  :member="m"
                  :current-user-role="role"
                  :current-user-id="authStore.user?.id ?? ''"
                  :is-admin="authStore.isAdmin"
                  @promote="handlePromoteMember"
                  @demote="handleDemoteMember"
                  @remove="handleRemoveMember"
                />
              </template>
            </MemberPill>
          </div>
        </div>

        <!-- Managers Section -->
        <div v-if="membersByRole.managers.length > 0" class="space-y-3">
          <h3 class="text-white text-lg font-medium flex items-center gap-2">
            <Icon icon="carbon:user-admin" class="text-blue-400" width="20" height="20" />
            Managers
            <span class="text-sm text-gray-400 font-normal">
              ({{ membersByRole.managers.length }})
            </span>
          </h3>
          <div class="flex flex-col md:flex-row md:flex-wrap gap-2 md:pl-7">
            <MemberPill 
              v-for="m in membersByRole.managers" 
              :key="m.profile.id" 
              :member="m"
              :show-role="false"
            >
              <template #actions>
                <MemberActionMenu
                  :member="m"
                  :current-user-role="role"
                  :current-user-id="authStore.user?.id ?? ''"
                  :is-admin="authStore.isAdmin"
                  @promote="handlePromoteMember"
                  @demote="handleDemoteMember"
                  @remove="handleRemoveMember"
                />
              </template>
            </MemberPill>
          </div>
        </div>

        <!-- Staff Section -->
        <div v-if="membersByRole.staff.length > 0" class="space-y-3">
          <h3 class="text-white text-lg font-medium flex items-center gap-2">
            <Icon icon="carbon:user-military" class="text-purple-400" width="20" height="20" />
            Staff
            <span class="text-sm text-gray-400 font-normal">
              ({{ membersByRole.staff.length }})
            </span>
          </h3>
          <div class="flex flex-col md:flex-row md:flex-wrap gap-2 md:pl-7">
            <MemberPill 
              v-for="m in membersByRole.staff" 
              :key="m.profile.id" 
              :member="m"
              :show-role="false"
            >
              <template #actions>
                <MemberActionMenu
                  :member="m"
                  :current-user-role="role"
                  :current-user-id="authStore.user?.id ?? ''"
                  :is-admin="authStore.isAdmin"
                  @promote="handlePromoteMember"
                  @demote="handleDemoteMember"
                  @remove="handleRemoveMember"
                />
              </template>
            </MemberPill>
          </div>
        </div>

        <!-- Members Section -->
        <div v-if="membersByRole.members.length > 0" class="space-y-3">
          <h3 class="text-white text-lg font-medium flex items-center gap-2">
            <Icon icon="carbon:user" class="text-green-400" width="20" height="20" />
            Members
            <span class="text-sm text-gray-400 font-normal">
              ({{ membersByRole.members.length }})
            </span>
          </h3>
          <div class="flex flex-col md:flex-row md:flex-wrap gap-2 md:pl-7">
            <MemberPill 
              v-for="m in membersByRole.members" 
              :key="m.profile.id" 
              :member="m"
              :show-role="false"
            >
              <template #actions>
                <MemberActionMenu
                  :member="m"
                  :current-user-role="role"
                  :current-user-id="authStore.user?.id ?? ''"
                  :is-admin="authStore.isAdmin"
                  @promote="handlePromoteMember"
                  @demote="handleDemoteMember"
                  @remove="handleRemoveMember"
                />
              </template>
            </MemberPill>
          </div>
        </div>
      </div>

      <p v-else class="text-sm text-gray-500">No members found.</p>
    </div>

    <AddMemberModal v-if="showAddMember && canManage" @close="closeAddMember" @submit="handleAddMember" />
  </div>
</template>

<style scoped>
/* intentionally empty: swiss-style = let spacing + type do the work */
</style>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Icon } from '@iconify/vue';
import { orgService } from "@/modules/orgs/services/orgServiceV2";
import { useActiveOrganizationStore } from "@/modules/orgs/stores/useActiveOrganizationStore";
import { useAuthStore } from '@/auth/stores/useAuthStore';
import type { OrgMember } from "@/modules/orgs/types";
import AddMemberModal from '@/modules/orgs/components/AddMemberModal.vue';

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
  closeAddMember();
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
}

function handleDemote() {
  const selected = members.value.filter(m => selectedMemberIds.value.has(m.profile.id));
  console.log('Demote members:', selected.map(m => ({ id: m.profile.id, username: displayName(m), role: m.membership.role })));
  // Stub: backend logic to be implemented
}

function handleRemoveMembers() {
  const selected = members.value.filter(m => selectedMemberIds.value.has(m.profile.id));
  console.log('Remove members:', selected.map(m => ({ id: m.profile.id, username: displayName(m) })));
  // Stub: backend logic to be implemented
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

function rolePillClass(role: string) {
  // color-coded (700 shades) to blend with dark scheme
  switch (role) {
    case "owner":
      return "border border-purple-700/40 bg-purple-700/20 text-purple-200";
    case "staff":
      return "border border-blue-700/40 bg-blue-700/20 text-blue-200";
    case "manager":
      return "border border-amber-700/40 bg-amber-700/20 text-amber-200";
    case "member":
      return "border border-emerald-700/40 bg-emerald-700/20 text-emerald-200";
    default:
      return "border border-slate-700/40 bg-slate-700/20 text-slate-200";
  }
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

        <!-- Add member control -->
        <div class="flex gap-2 items-center justify-end">
          <button v-if="canManage" type="button"
            class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-green-500 bg-green-500/70 hover:bg-green-700/70 text-xs transition disabled:opacity-50"
            :disabled="loading || !orgId" @click="openAddMember">
            <Icon icon="carbon:add" width="15" height="15" />
            Add Member
          </button>
        </div>
      </div>

      <!-- Membership select control -->
      <div v-if="canManage && hasSelection" class="flex items-center justify-between py-2 border-t border-b border-white/20 mb-6">
        <div>
          <p class="text-sm text-white/70">
            {{ selectedMemberIds.size }} member(s) selected
          </p>
        </div>
        <div class="flex gap-2 items-center">
          <button type="button"
            class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-sky-500 bg-sky-500/70 hover:bg-sky-700/70 text-xs transition"
            @click="handlePromote">
            <Icon icon="carbon:arrow-up" width="15" height="15" />
            Promote
          </button>
          <button type="button"
            class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-sky-500 bg-sky-500/70 hover:bg-sky-700/70 text-xs transition"
            @click="handleDemote">
            <Icon icon="carbon:arrow-down" width="15" height="15" />
            Demote
          </button>
          <button type="button"
            class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-red-500 bg-red-500/70 hover:bg-red-700/70 text-xs transition"
            @click="handleRemoveMembers">
            <Icon icon="carbon:trash-can" width="15" height="15" />
            Remove
          </button>
        </div>
      </div>

      <div v-if="error" class="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
        {{ error }}
      </div>

      <div v-if="sortedMembers.length" class="flex flex-wrap gap-2">
        <div v-for="m in sortedMembers" :key="m.profile.id"
          class="group flex items-center gap-2 rounded-full px-3 py-1.5 transition" :class="[
            isSelected(m.profile.id) ? 'border border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-500/20' : 'border border-white/10 bg-white/0 hover:bg-white/5',
            canManage ? 'hover:cursor-pointer' : ''
          ]" @click="toggleMemberSelection(m.profile.id)">
          <span class="text-sm text-gray-500 group-hover:text-white transition">
            {{ displayName(m) }}
          </span>
          <!-- <span class="text-xs text-gray-500/80 group-hover:text-gray-300 transition">
            {{ m.profile.xp ?? 0 }} xp
          </span> -->
          <span class="text-[11px] px-2 py-0.5 rounded-full leading-none" :class="rolePillClass(m.membership.role)">
            {{ m.membership.role }}
          </span>
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

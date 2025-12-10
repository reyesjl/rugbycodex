<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useActiveOrgStore } from '@/modules/orgs/stores/useActiveOrgStore';
import { orgService } from '@/modules/orgs/services/orgService';
import { profileService } from '@/modules/profiles/services/ProfileService';
import BatchActionBar, { type BatchAction } from '@/components/ui/tables/BatchActionBar.vue';
import { MEMBERSHIP_ROLES, ROLE_ORDER, type MembershipRole, type ProfileWithMembership } from '@/modules/profiles/types';

const props = defineProps<{ slug?: string | string[] }>();

const normalizedSlug = computed(() => {
  if (!props.slug) return null;
  return Array.isArray(props.slug) ? props.slug[0] : props.slug;
});

const authStore = useAuthStore();
const activeOrgStore = useActiveOrgStore();
const { isAdmin } = storeToRefs(authStore);
const { activeMembership } = storeToRefs(activeOrgStore);

const orgName = ref('');
const orgId = ref<string | null>(null);
const members = ref<ProfileWithMembership[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const savingMemberId = ref<string | null>(null);
const roleError = ref<string | null>(null);
const roleSuccess = ref<string | null>(null);
const memberSearch = ref('');
const selectedMemberIds = ref<string[]>([]);
const disabledMemberMap = ref<Record<string, boolean>>({});
const isBatchProcessing = ref(false);
const roleLadder = MEMBERSHIP_ROLES.map((role) => role.value);

const formatRole = (role: string) => role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const formatJoinDate = (date: Date) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(date);
const memberHandle = (member: ProfileWithMembership) => (member.username ? `@${member.username}` : member.name);

const canManageMembers = computed(() => {
  if (isAdmin.value) return true;
  const role = activeMembership.value?.org_role;
  if (!role) return false;
  const managerOrder = ROLE_ORDER.manager ?? Infinity;
  return (ROLE_ORDER[role] ?? Infinity) <= managerOrder;
});

const canSelectMembers = computed(() => canManageMembers.value);

const loadMembers = async (slug: string) => {
  loading.value = true;
  error.value = null;
  try {
    const org = await orgService.organizations.getBySlug(slug);
    orgName.value = org.name;
    orgId.value = org.id;
    members.value = await profileService.memberships.listByOrganization(org.id);
  } catch (err) {
    members.value = [];
    orgId.value = null;
    error.value = err instanceof Error ? err.message : 'Unable to load members right now.';
  } finally {
    loading.value = false;
  }
};

const filteredMembers = computed(() => {
  if (!memberSearch.value.trim()) {
    return [...members.value];
  }
  const query = memberSearch.value.toLowerCase();
  return members.value.filter((member) => {
    const handle = memberHandle(member).toLowerCase();
    const name = member.name.toLowerCase();
    const role = member.org_role.toLowerCase();
    return handle.includes(query) || name.includes(query) || role.includes(query);
  });
});

const isMemberDisabled = (memberId: string) => Boolean(disabledMemberMap.value[memberId] || savingMemberId.value === memberId);
const isMemberSelected = (memberId: string) => selectedMemberIds.value.includes(memberId);

const selectableMembers = computed(() => filteredMembers.value.filter((member) => !isMemberDisabled(member.id)));
const allSelectableSelected = computed(
  () => selectableMembers.value.length > 0 && selectableMembers.value.every((member) => isMemberSelected(member.id))
);
const selectionCount = computed(() => selectedMemberIds.value.length);

const toggleMemberSelection = (memberId: string) => {
  if (!canSelectMembers.value || isMemberDisabled(memberId)) return;
  if (isMemberSelected(memberId)) {
    selectedMemberIds.value = selectedMemberIds.value.filter((id) => id !== memberId);
  } else {
    selectedMemberIds.value = [...selectedMemberIds.value, memberId];
  }
};

const handleSelectAll = (checked: boolean) => {
  if (!canSelectMembers.value) return;
  selectedMemberIds.value = checked ? selectableMembers.value.map((member) => member.id) : [];
};

const handleSelectAllChange = (event: globalThis.Event) => {
  const target = event.target as globalThis.HTMLInputElement | null;
  handleSelectAll(Boolean(target?.checked));
};

const clearMemberSelection = () => {
  selectedMemberIds.value = [];
};

const toggleMemberDisable = (memberId: string) => {
  const nextState = !disabledMemberMap.value[memberId];
  disabledMemberMap.value = { ...disabledMemberMap.value, [memberId]: nextState };
  if (nextState) {
    selectedMemberIds.value = selectedMemberIds.value.filter((id) => id !== memberId);
  }
};

const handleInviteMember = () => {
  console.info('Invite member');
};

const handleRoleUpdate = async (member: ProfileWithMembership, nextRole: MembershipRole) => {
  if (!orgId.value) {
    roleError.value = 'Organization not loaded yet.';
    return;
  }
  if (member.org_role === nextRole) {
    return;
  }
  savingMemberId.value = member.id;
  roleError.value = null;
  roleSuccess.value = null;
  try {
    await profileService.memberships.setRole(member.id, orgId.value, nextRole);
    member.org_role = nextRole;
    roleSuccess.value = `${memberHandle(member)} is now ${formatRole(nextRole)}.`;
  } catch (err) {
    roleError.value = err instanceof Error ? err.message : 'Unable to update role right now.';
  } finally {
    savingMemberId.value = null;
  }
};

const handleRoleSelect = (member: ProfileWithMembership, event: globalThis.Event) => {
  const target = event.target as globalThis.HTMLSelectElement | null;
  if (!target) return;
  handleRoleUpdate(member, target.value as MembershipRole);
};

const getNextHigherRole = (role: MembershipRole): MembershipRole => {
  const index = roleLadder.indexOf(role);
  if (index <= 0) {
    return role;
  }
  return roleLadder[index - 1] as MembershipRole;
};

const getNextLowerRole = (role: MembershipRole): MembershipRole => {
  const index = roleLadder.indexOf(role);
  if (index === -1 || index >= roleLadder.length - 1) {
    return role;
  }
  return roleLadder[index + 1] as MembershipRole;
};

const adjustMemberRoles = async (direction: 'promote' | 'demote') => {
  if (!orgId.value || !selectedMemberIds.value.length) return;
  const adjustments = selectedMemberIds.value
    .map((memberId) => {
      const member = members.value.find((entry) => entry.id === memberId);
      if (!member) return null;
      const targetRole = direction === 'promote' ? getNextHigherRole(member.org_role) : getNextLowerRole(member.org_role);
      if (targetRole === member.org_role) return null;
      return { memberId, targetRole };
    })
    .filter(Boolean) as { memberId: string; targetRole: MembershipRole }[];

  roleError.value = null;
  roleSuccess.value = null;

  if (!adjustments.length) {
    roleSuccess.value = direction === 'promote'
      ? 'Selected members are already at the highest role available.'
      : 'Selected members are already at the lowest role available.';
    return;
  }

  isBatchProcessing.value = true;
  try {
    await Promise.all(
      adjustments.map(({ memberId, targetRole }) => profileService.memberships.setRole(memberId, orgId.value!, targetRole))
    );
    members.value = members.value.map((member) => {
      const update = adjustments.find((adjustment) => adjustment.memberId === member.id);
      return update ? { ...member, org_role: update.targetRole } : member;
    });
    roleSuccess.value = direction === 'promote'
      ? `${adjustments.length} member(s) promoted.`
      : `${adjustments.length} member(s) demoted.`;
    clearMemberSelection();
  } catch (err) {
    roleError.value = err instanceof Error ? err.message : `Unable to ${direction} selected members right now.`;
  } finally {
    isBatchProcessing.value = false;
  }
};

const handleBatchPromote = async () => {
  await adjustMemberRoles('promote');
};

const handleBatchDemote = async () => {
  await adjustMemberRoles('demote');
};

const handleBatchRemove = async () => {
  if (!orgId.value || !selectedMemberIds.value.length) return;
  if (!window.confirm('Remove selected members from this organization?')) {
    return;
  }
  isBatchProcessing.value = true;
  roleError.value = null;
  try {
    await Promise.all(selectedMemberIds.value.map((memberId) => profileService.memberships.remove(memberId, orgId.value!)));
    members.value = members.value.filter((member) => !selectedMemberIds.value.includes(member.id));
    roleSuccess.value = 'Selected members removed.';
    clearMemberSelection();
  } catch (err) {
    roleError.value = err instanceof Error ? err.message : 'Unable to remove selected members right now.';
  } finally {
    isBatchProcessing.value = false;
  }
};

const memberBatchActions = computed<BatchAction[]>(() => [
  {
    id: 'promote',
    label: 'Promote',
    icon: 'mdi:arrow-up-bold',
    variant: 'secondary',
    disabled: isBatchProcessing.value || !canManageMembers.value,
    onClick: handleBatchPromote,
  },
  {
    id: 'demote',
    label: 'Demote',
    icon: 'mdi:arrow-down-bold',
    variant: 'secondary',
    disabled: isBatchProcessing.value || !canManageMembers.value,
    onClick: handleBatchDemote,
  },
  {
    id: 'remove',
    label: 'Remove',
    icon: 'mdi:account-remove',
    variant: 'primary',
    disabled: isBatchProcessing.value || !canManageMembers.value,
    onClick: handleBatchRemove,
  },
]);

watch(
  normalizedSlug,
  (slug) => {
    if (!slug) {
      error.value = 'Organization not found.';
      orgId.value = null;
      members.value = [];
      return;
    }
    loadMembers(slug);
  },
  { immediate: true },
);

watch(
  filteredMembers,
  (list) => {
    const validIds = new Set(list.filter((member) => !isMemberDisabled(member.id)).map((member) => member.id));
    selectedMemberIds.value = selectedMemberIds.value.filter((id) => validIds.has(id));
  },
  { immediate: true }
);
</script>

<template>
  <div class="container-lg space-y-6 py-5 text-white">
    <header class="space-y-1">
      <p class="text-sm uppercase tracking-wide text-white/60">Organization members</p>
      <h1 class="text-3xl font-semibold">
        {{ orgName || 'Members' }}
      </h1>
    </header>

    <div v-if="loading" class="rounded border border-white/15 bg-black/30 p-4 text-white/70">
      Loading members…
    </div>

    <div v-else-if="error" class="rounded border border-rose-400/40 bg-rose-500/10 p-4 text-white">
      <p class="font-semibold">{{ error }}</p>
      <p class="text-sm text-white/80">Refresh or try another organization.</p>
    </div>

    <section v-else class="space-y-4">
      <div class="flex flex-col gap-3 rounded border border-white/10 bg-white/5 p-4">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="relative w-full md:max-w-md">
            <input
              v-model="memberSearch"
              type="search"
              placeholder="Search members by name, handle, or role"
              class="w-full rounded border border-white/20 bg-black/40 py-3 pl-4 pr-4 text-white placeholder:text-white/40 focus:border-white focus:outline-none"
            />
          </div>
          <button
            v-if="canManageMembers"
            type="button"
            class="flex items-center gap-2 rounded border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-black"
            @click="handleInviteMember"
          >
            Invite member
          </button>
        </div>

        <div v-if="roleSuccess || roleError" class="space-y-2">
          <p v-if="roleSuccess" class="rounded border border-emerald-400/50 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            {{ roleSuccess }}
          </p>
          <p v-if="roleError" class="rounded border border-rose-400/50 bg-rose-500/10 p-3 text-sm text-rose-200">
            {{ roleError }}
          </p>
        </div>

        <div class="overflow-hidden rounded border border-white/10">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[720px] text-left text-sm">
              <thead class="bg-white/5 text-xs uppercase tracking-wide text-white/70">
                <tr>
                  <th scope="col" class="w-12 px-4 py-3">
                    <label class="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        class="h-4 w-4 rounded border-white/40 bg-transparent"
                        :checked="allSelectableSelected"
                        :disabled="selectableMembers.length === 0 || !canSelectMembers"
                        @change="handleSelectAllChange"
                      />
                      <span class="sr-only">Select all members</span>
                    </label>
                  </th>
                  <th scope="col" class="px-4 py-3">Member</th>
                  <th scope="col" class="px-4 py-3">Role</th>
                  <th scope="col" class="px-4 py-3">XP</th>
                  <th scope="col" class="px-4 py-3">Joined</th>
                  <th scope="col" class="px-4 py-3">Status</th>
                  <th scope="col" class="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredMembers.length === 0">
                  <td colspan="7" class="px-4 py-6 text-center text-white/70">
                    No members yet.
                  </td>
                </tr>
                <tr
                  v-for="member in filteredMembers"
                  :key="member.id"
                  :data-state="isMemberDisabled(member.id) ? 'disabled' : isMemberSelected(member.id) ? 'selected' : 'enabled'"
                  :aria-disabled="isMemberDisabled(member.id)"
                  class="border-b border-white/10 text-white transition-colors last:border-0"
                  :class="[
                    isMemberSelected(member.id) ? 'bg-white/10' : 'hover:bg-white/5',
                    isMemberDisabled(member.id) ? 'opacity-50 cursor-not-allowed' : canSelectMembers ? 'cursor-pointer' : ''
                  ]"
                  @click="() => toggleMemberSelection(member.id)"
                >
                  <td class="px-4 py-3">
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-white/40 bg-transparent"
                      :checked="isMemberSelected(member.id)"
                      :disabled="isMemberDisabled(member.id) || !canSelectMembers"
                      @click.stop
                      @change="() => toggleMemberSelection(member.id)"
                    />
                  </td>
                  <td class="px-4 py-3">
                    <p class="font-semibold">{{ memberHandle(member) }}</p>
                    <p class="text-xs text-white/60">{{ member.name }}</p>
                  </td>
                  <td class="px-4 py-3">
                    <div v-if="canManageMembers" class="flex items-center gap-2">
                      <select
                        class="rounded border border-white/30 bg-black/30 px-2 py-1 text-sm text-white"
                        :disabled="savingMemberId === member.id"
                        :value="member.org_role"
                        @click.stop
                        @change="(event) => handleRoleSelect(member, event)">
                        <option
                          v-for="role in MEMBERSHIP_ROLES"
                          :key="role.value"
                          :value="role.value"
                        >
                          {{ role.label }}
                        </option>
                      </select>
                    </div>
                    <p v-else class="text-sm text-white/80">{{ formatRole(member.org_role) }}</p>
                  </td>
                  <td class="px-4 py-3">
                    {{ member.xp ?? '—' }}
                  </td>
                  <td class="px-4 py-3">
                    {{ formatJoinDate(member.join_date) }}
                  </td>
                  <td class="px-4 py-3">
                    <span class="rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide"
                      :class="isMemberDisabled(member.id) ? 'border-amber-300/50 text-amber-200' : 'border-emerald-300/50 text-emerald-200'"
                    >
                      {{ isMemberDisabled(member.id) ? 'Disabled' : 'Enabled' }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-3">
                      <RouterLink
                        class="text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
                        :to="member.username
                          ? `/v2/profile/${member.username}`
                          : member.id
                            ? `/v2/profile/${member.id}`
                            : '/v2/profile'"
                        @click.stop
                      >
                        View
                      </RouterLink>
                      <button
                        v-if="canManageMembers"
                        type="button"
                        class="text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
                        @click.stop="() => toggleMemberDisable(member.id)"
                      >
                        {{ isMemberDisabled(member.id) ? 'Enable' : 'Disable' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <BatchActionBar
        :selected-count="selectionCount"
        :actions="memberBatchActions"
        @cancel="clearMemberSelection"
      />
    </section>
  </div>
</template>

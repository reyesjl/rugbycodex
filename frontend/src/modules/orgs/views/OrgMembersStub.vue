<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useActiveOrgStore } from '@/modules/orgs/stores/useActiveOrgStore';
import { orgService } from '@/modules/orgs/services/orgService';
import { profileService } from '@/modules/profiles/services/ProfileService';
import BatchActionBar, { type BatchAction } from '@/components/ui/tables/BatchActionBar.vue';
import { MEMBERSHIP_ROLES, ROLE_ORDER, type MembershipRole, type ProfileWithMembership, type UserProfile } from '@/modules/profiles/types';

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
const showRoleFilter = ref(false);
const activeRoleFilters = ref<MembershipRole[]>([]);
const roleFilterDraft = ref<Set<MembershipRole>>(new Set());
const roleFilterContainer = ref<HTMLElement | null>(null);
const showInviteModal = ref(false);
const inviteIdentifier = ref('');
const inviteRole = ref<MembershipRole>('member');
const inviteError = ref<string | null>(null);
const inviteLoading = ref(false);
const inviteSuggestions = ref<UserProfile[]>([]);
const inviteSuggestionsLoading = ref(false);
const inviteSuggestionIndex = ref(-1);
const inviteSuggestionsError = ref<string | null>(null);

const inviteSearchTerm = computed(() => {
  const trimmed = inviteIdentifier.value.trim();
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
});
const inviteSearchTermNormalized = computed(() => inviteSearchTerm.value.toLowerCase());
const inviteSearchTermIsUuid = computed(() => uuidPattern.test(inviteSearchTerm.value));
const inviteSearchEligible = computed(
  () => showInviteModal.value && inviteSearchTerm.value.length >= 2 && !inviteSearchTermIsUuid.value
);
const showInviteSuggestionsHint = computed(
  () => showInviteModal.value && inviteSearchTerm.value.length > 0 && inviteSearchTerm.value.length < 2 && !inviteSearchTermIsUuid.value
);
const showInviteSuggestionDropdown = computed(
  () => inviteSearchEligible.value && (inviteSuggestionsLoading.value || inviteSuggestions.value.length > 0 || !!inviteSuggestionsError.value)
);
const suggestionStatusMessage = computed(() => {
  if (inviteSuggestionsLoading.value) return 'Searching…';
  if (inviteSuggestionsError.value) return inviteSuggestionsError.value;
  if (!inviteSuggestions.value.length) return 'No usernames match.';
  return '';
});

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
    return members.value.filter((member) => {
      if (!activeRoleFilters.value.length) return true;
      return activeRoleFilters.value.includes(member.org_role);
    });
  }
  const query = memberSearch.value.toLowerCase();
  return members.value.filter((member) => {
    const handle = memberHandle(member).toLowerCase();
    const name = member.name.toLowerCase();
    const role = member.org_role.toLowerCase();
    const matchesSearch = handle.includes(query) || name.includes(query) || role.includes(query);
    const matchesRole = !activeRoleFilters.value.length || activeRoleFilters.value.includes(member.org_role);
    return matchesSearch && matchesRole;
  });
});

const isMemberDisabled = (memberId: string) => Boolean(disabledMemberMap.value[memberId] || savingMemberId.value === memberId);
const isMemberSelected = (memberId: string) => selectedMemberIds.value.includes(memberId);

const selectableMembers = computed(() => filteredMembers.value.filter((member) => !isMemberDisabled(member.id)));
const allSelectableSelected = computed(
  () => selectableMembers.value.length > 0 && selectableMembers.value.every((member) => isMemberSelected(member.id))
);
const selectionCount = computed(() => selectedMemberIds.value.length);
const roleFilterActive = computed(() => activeRoleFilters.value.length > 0);
const roleFilterButtonLabel = computed(() => {
  if (!roleFilterActive.value) {
    return 'Filter roles';
  }
  if (activeRoleFilters.value.length === 1) {
    const role = MEMBERSHIP_ROLES.find((option) => option.value === activeRoleFilters.value[0]);
    return role ? `Filter: ${role.label}` : 'Filter roles';
  }
  return `Filter (${activeRoleFilters.value.length})`;
});
const canSubmitInvite = computed(() => Boolean(inviteIdentifier.value.trim()) && !inviteLoading.value);

const syncRoleFilterDraft = () => {
  roleFilterDraft.value = new Set(activeRoleFilters.value);
};

const toggleRoleFilterPanel = () => {
  if (showRoleFilter.value) {
    syncRoleFilterDraft();
    showRoleFilter.value = false;
  } else {
    syncRoleFilterDraft();
    showRoleFilter.value = true;
  }
};

const closeRoleFilter = () => {
  showRoleFilter.value = false;
  syncRoleFilterDraft();
};

const toggleDraftRole = (role: MembershipRole) => {
  const draft = new Set(roleFilterDraft.value);
  if (draft.has(role)) {
    draft.delete(role);
  } else {
    draft.add(role);
  }
  roleFilterDraft.value = draft;
};

const resetRoleFilters = () => {
  activeRoleFilters.value = [];
  roleFilterDraft.value = new Set();
  showRoleFilter.value = false;
};

const applyRoleFilters = () => {
  activeRoleFilters.value = Array.from(roleFilterDraft.value);
  showRoleFilter.value = false;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let inviteSuggestionDebounce: ReturnType<typeof setTimeout> | null = null;
let inviteSuggestionRequestId = 0;

const clearInviteSuggestions = () => {
  inviteSuggestions.value = [];
  inviteSuggestionsLoading.value = false;
  inviteSuggestionsError.value = null;
  inviteSuggestionIndex.value = -1;
};

const fetchInviteSuggestions = async (term: string) => {
  inviteSuggestionRequestId += 1;
  const requestId = inviteSuggestionRequestId;
  inviteSuggestionsLoading.value = true;
  inviteSuggestionsError.value = null;
  try {
    const results = await profileService.profiles.searchByUsername(term, 6);
    if (requestId !== inviteSuggestionRequestId) return;
    inviteSuggestions.value = results;
  } catch (err) {
    if (requestId !== inviteSuggestionRequestId) return;
    inviteSuggestions.value = [];
    inviteSuggestionsError.value = err instanceof Error ? err.message : 'Unable to search usernames.';
  } finally {
    if (requestId === inviteSuggestionRequestId) {
      inviteSuggestionsLoading.value = false;
    }
  }
};

const scheduleInviteSuggestionsFetch = (term: string) => {
  if (inviteSuggestionDebounce) {
    clearTimeout(inviteSuggestionDebounce);
  }
  inviteSuggestionDebounce = setTimeout(() => {
    fetchInviteSuggestions(term);
  }, 220);
};

watch([inviteSearchTermNormalized, inviteSearchEligible], ([term]) => {
  inviteSuggestionIndex.value = -1;
  if (!inviteSearchEligible.value) {
    clearInviteSuggestions();
    return;
  }
  scheduleInviteSuggestionsFetch(term);
});

watch(showInviteModal, (isOpen) => {
  if (!isOpen && inviteSuggestionDebounce) {
    clearTimeout(inviteSuggestionDebounce);
    inviteSuggestionDebounce = null;
  }
});

const resetInviteForm = () => {
  inviteIdentifier.value = '';
  inviteRole.value = 'member';
  inviteError.value = null;
  clearInviteSuggestions();
};

const handleInviteMember = () => {
  if (!canManageMembers.value) return;
  resetInviteForm();
  showInviteModal.value = true;
};

const closeInviteModal = () => {
  if (inviteLoading.value) return;
  showInviteModal.value = false;
  clearInviteSuggestions();
};

const resolveInviteProfile = async (identifier: string) => {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error('Enter a username or UUID.');
  }
  const cleaned = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  if (uuidPattern.test(cleaned)) {
    return profileService.profiles.getById(cleaned);
  }
  return profileService.profiles.getByUsername(cleaned);
};

const handleInviteSubmit = async () => {
  if (!normalizedSlug.value) {
    inviteError.value = 'Organization slug is missing.';
    return;
  }
  inviteLoading.value = true;
  inviteError.value = null;
  try {
    const profile = await resolveInviteProfile(inviteIdentifier.value);
    await profileService.memberships.addByOrgSlug(profile.id, normalizedSlug.value, inviteRole.value);
    await loadMembers(normalizedSlug.value);
    roleSuccess.value = `${profile.name} added as ${formatRole(inviteRole.value)}.`;
    showInviteModal.value = false;
    resetInviteForm();
    clearInviteSuggestions();
  } catch (err) {
    inviteError.value = err instanceof Error ? err.message : 'Unable to invite member right now.';
  } finally {
    inviteLoading.value = false;
  }
};

const selectInviteSuggestion = (profile: UserProfile) => {
  inviteIdentifier.value = `@${profile.username}`;
  clearInviteSuggestions();
};

const moveInviteSuggestionHighlight = (direction: 1 | -1) => {
  if (!inviteSuggestions.value.length) return;
  const nextIndex = (inviteSuggestionIndex.value + direction + inviteSuggestions.value.length) % inviteSuggestions.value.length;
  inviteSuggestionIndex.value = nextIndex;
};

const handleInviteInputKeydown = (event: globalThis.KeyboardEvent) => {
  if (!showInviteSuggestionDropdown.value) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveInviteSuggestionHighlight(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveInviteSuggestionHighlight(-1);
  } else if (event.key === 'Enter') {
    if (inviteSuggestionIndex.value >= 0) {
      const suggestion = inviteSuggestions.value[inviteSuggestionIndex.value];
      if (suggestion) {
        event.preventDefault();
        selectInviteSuggestion(suggestion);
      }
    }
  } else if (event.key === 'Escape') {
    event.preventDefault();
    clearInviteSuggestions();
  }
};

const handleGlobalClick = (event: MouseEvent) => {
  if (!showRoleFilter.value) return;
  const container = roleFilterContainer.value;
  if (container && !container.contains(event.target as Node)) {
    closeRoleFilter();
  }
};

onMounted(() => {
  document.addEventListener('click', handleGlobalClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleGlobalClick);
  if (inviteSuggestionDebounce) {
    clearTimeout(inviteSuggestionDebounce);
    inviteSuggestionDebounce = null;
  }
});

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
    icon: 'carbon:arrow-up',
    variant: 'secondary',
    disabled: isBatchProcessing.value || !canManageMembers.value,
    onClick: handleBatchPromote,
  },
  {
    id: 'demote',
    label: 'Demote',
    icon: 'carbon:arrow-down',
    variant: 'secondary',
    disabled: isBatchProcessing.value || !canManageMembers.value,
    onClick: handleBatchDemote,
  },
  {
    id: 'remove',
    label: 'Remove',
    icon: 'carbon:user--x',
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
          <div class="flex flex-wrap items-center justify-end gap-2">
            <div class="relative" ref="roleFilterContainer">
              <button
                type="button"
                class="flex items-center gap-2 rounded border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition"
                :class="roleFilterActive
                  ? 'border-white bg-white text-black'
                  : 'border-white/30 text-white hover:bg-white hover:text-black'"
                aria-haspopup="true"
                :aria-expanded="showRoleFilter"
                @click="toggleRoleFilterPanel"
              >
                <Icon icon="carbon:filter" class="h-4 w-4" />
                {{ roleFilterButtonLabel }}
              </button>
              <transition name="filter-panel">
                <div
                  v-if="showRoleFilter"
                  class="absolute right-0 top-full z-30 mt-2 w-64 rounded border border-white/15 bg-black/90 p-4 text-sm text-white shadow-2xl"
                  @click.stop
                >
                  <p class="text-xs uppercase tracking-wide text-white/60">Filter options</p>
                  <div class="mt-3 space-y-2">
                    <label
                      v-for="role in MEMBERSHIP_ROLES"
                      :key="role.value"
                      class="flex items-center gap-2 text-sm text-white"
                    >
                      <input
                        type="checkbox"
                        class="h-4 w-4 rounded border-white/40 bg-transparent"
                        :checked="roleFilterDraft.has(role.value)"
                        @change="() => toggleDraftRole(role.value)"
                      />
                      {{ role.label }}
                    </label>
                  </div>
                  <div class="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      class="flex-1 rounded border border-white/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
                      @click="resetRoleFilters"
                    >
                      Reset filters
                    </button>
                    <button
                      type="button"
                      class="flex-1 rounded border border-blue-500 bg-blue-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-blue-500"
                      @click="applyRoleFilters"
                    >
                      Apply filter
                    </button>
                  </div>
                </div>
              </transition>
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

  <teleport to="body">
    <transition name="invite-modal">
      <div
        v-if="showInviteModal"
        class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
        role="dialog"
        aria-modal="true"
        aria-label="Invite member to organization"
        @click.self="closeInviteModal"
      >
        <div class="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-[#0f1016] text-white shadow-2xl">
          <header class="border-b border-white/10 px-6 py-4">
            <p class="text-xs uppercase tracking-wide text-white/50">Invite member</p>
            <h2 class="text-xl font-semibold">Add someone to {{ orgName || 'this org' }}</h2>
          </header>
          <div class="space-y-4 px-6 py-5">
            <div class="space-y-1">
              <label class="text-xs font-semibold uppercase tracking-wide text-white/60" for="invite-identifier">
                Username or UUID
              </label>
              <div class="relative">
                <input
                  id="invite-identifier"
                  v-model="inviteIdentifier"
                  type="text"
                  autocomplete="off"
                  placeholder="@handle or 00000000-0000-0000-0000-000000000000"
                  class="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                  @keydown="handleInviteInputKeydown"
                />
                <div
                  v-if="showInviteSuggestionDropdown"
                  class="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded border border-white/15 bg-black/90 text-sm shadow-2xl"
                >
                  <p v-if="suggestionStatusMessage" class="px-3 py-2 text-white/60">
                    {{ suggestionStatusMessage }}
                  </p>
                  <button
                    v-for="(profile, index) in inviteSuggestions"
                    v-else
                    :key="profile.id"
                    type="button"
                    class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-white/10"
                    :class="inviteSuggestionIndex === index ? 'bg-white/10' : ''"
                    @mousedown.prevent="selectInviteSuggestion(profile)"
                    @mouseenter="inviteSuggestionIndex = index"
                  >
                    <span class="font-semibold">@{{ profile.username }}</span>
                    <span class="text-xs text-white/60">{{ profile.name }}</span>
                  </button>
                </div>
              </div>
              <p v-if="showInviteSuggestionsHint" class="text-xs text-white/50">
                Type at least 2 characters to search usernames.
              </p>
            </div>
            <div class="space-y-1">
              <label class="text-xs font-semibold uppercase tracking-wide text-white/60" for="invite-role">
                Role
              </label>
              <select
                id="invite-role"
                v-model="inviteRole"
                class="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
              >
                <option
                  v-for="role in MEMBERSHIP_ROLES"
                  :key="role.value"
                  :value="role.value"
                >
                  {{ role.label }}
                </option>
              </select>
            </div>
            <p v-if="inviteError" class="text-sm text-rose-300">
              {{ inviteError }}
            </p>
          </div>
          <div class="flex justify-end gap-3 border-t border-white/10 bg-black/40 px-6 py-4">
            <button
              type="button"
              class="rounded border border-white/30 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="inviteLoading"
              @click="closeInviteModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded border border-blue-500 bg-blue-600 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canSubmitInvite"
              @click="handleInviteSubmit"
            >
              Add member
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.filter-panel-enter-active,
.filter-panel-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.filter-panel-enter-from,
.filter-panel-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.invite-modal-enter-active,
.invite-modal-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.invite-modal-enter-from,
.invite-modal-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>

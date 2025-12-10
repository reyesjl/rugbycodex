<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import RefreshButton from '@/components/RefreshButton.vue';
import BatchActionBar, { type BatchAction } from '@/components/ui/tables/BatchActionBar.vue';
import { useOrganizationList } from '@/modules/orgs/composables/useOrganizationsList';
import { orgService } from '@/modules/orgs/services/orgService';
import { useProfilesList } from '@/modules/profiles/composables/useProfileList';
import { profileService } from '@/modules/profiles/services/ProfileService';
import type { Organization } from '@/modules/orgs/types';
import type { UserProfile } from '@/modules/profiles/types';

const orgList = useOrganizationList();
const profileList = useProfilesList();

const orgDeleteError = ref<string | null>(null);
const searchQuery = ref('');
const showDeleteModal = ref(false);
const orgToDelete = ref<Organization | null>(null);
const isDeleting = ref(false);
const selectedOrgIds = ref<string[]>([]);
const disabledOrgMap = ref<Record<string, boolean>>({});
const isBatchProcessing = ref(false);
const copyStatus = ref<Record<string, 'idle' | 'copied' | 'error'>>({});
const copyResetTimers = new Map<string, number>();
const createSuccessMessage = ref<string | null>(null);

const showCreateModal = ref(false);
const createOrgName = ref('');
const createOrgSlug = ref('');
const slugManuallyEdited = ref(false);
const createOwnerInput = ref('');
const ownerIdentifierLock = ref<string | null>(null);
const storageLimitMb = ref(10240);
const createOrgError = ref<string | null>(null);
const createOrgLoading = ref(false);
const ownerSuggestions = ref<UserProfile[]>([]);
const ownerSuggestionsLoading = ref(false);
const ownerSuggestionsError = ref<string | null>(null);
const ownerSuggestionIndex = ref(-1);

const STORAGE_OPTIONS = [
  { label: '5 GB', value: 5 * 1024 },
  { label: '10 GB', value: 10 * 1024 },
  { label: '20 GB', value: 20 * 1024 },
];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let ownerSuggestionDebounce: ReturnType<typeof setTimeout> | null = null;
let ownerSuggestionRequestId = 0;

const handleRefresh = async () => {
  await Promise.all([orgList.loadOrganizations(), profileList.loadProfiles()]);
};

const handleCreateOrg = () => {
  resetCreateForm();
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  if (createOrgLoading.value) return;
  showCreateModal.value = false;
  resetCreateForm();
};

function resetCreateForm() {
  createOrgName.value = '';
  createOrgSlug.value = '';
  slugManuallyEdited.value = false;
  createOwnerInput.value = '';
  ownerIdentifierLock.value = null;
  storageLimitMb.value = 10240;
  createOrgError.value = null;
  clearOwnerSuggestions();
}

const filteredOrgs = computed(() => {
  const source = [...orgList.organizations.value];
  if (!searchQuery.value.trim()) {
    return source;
  }
  const query = searchQuery.value.toLowerCase();
  return source.filter((org) => org.name.toLowerCase().includes(query) || org.slug.toLowerCase().includes(query));
});

const isOrgDisabled = (orgId: string) => Boolean(disabledOrgMap.value[orgId]);
const isOrgSelected = (orgId: string) => selectedOrgIds.value.includes(orgId);

const selectableOrgs = computed(() => filteredOrgs.value.filter((org) => !isOrgDisabled(org.id)));
const allSelectableSelected = computed(
  () => selectableOrgs.value.length > 0 && selectableOrgs.value.every((org) => isOrgSelected(org.id))
);
const selectionCount = computed(() => selectedOrgIds.value.length);

const ownerProfilesById = computed<Record<string, UserProfile>>(() =>
  profileList.profiles.value.reduce<Record<string, UserProfile>>((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {})
);

const getOwnerProfile = (ownerId: string | null) => {
  if (!ownerId) return null;
  return ownerProfilesById.value[ownerId] ?? null;
};

const ownerProfilePath = (ownerId: string | null) => {
  if (!ownerId) return null;
  const profile = getOwnerProfile(ownerId);
  return profile?.username ? `/v2/profile/${profile.username}` : `/v2/profile/${ownerId}`;
};

const ownerPrimaryLabel = (ownerId: string | null) => {
  const profile = getOwnerProfile(ownerId);
  if (profile?.name) return profile.name;
  if (profile?.username) return `@${profile.username}`;
  return ownerId ?? '—';
};

const ownerSecondaryLabel = (ownerId: string | null) => {
  const profile = getOwnerProfile(ownerId);
  if (profile?.name && profile?.username) {
    return `@${profile.username}`;
  }
  return null;
};

const handleSelectAll = (checked: boolean) => {
  selectedOrgIds.value = checked ? selectableOrgs.value.map((org) => org.id) : [];
};

const handleSelectAllChange = (event: globalThis.Event) => {
  const target = event.target as globalThis.HTMLInputElement | null;
  handleSelectAll(Boolean(target?.checked));
};

const toggleOrgSelection = (orgId: string) => {
  if (isOrgDisabled(orgId)) return;
  if (isOrgSelected(orgId)) {
    selectedOrgIds.value = selectedOrgIds.value.filter((id) => id !== orgId);
  } else {
    selectedOrgIds.value = [...selectedOrgIds.value, orgId];
  }
};

const clearOrgSelection = () => {
  selectedOrgIds.value = [];
};

const toggleOrgDisable = (orgId: string) => {
  const nextState = !isOrgDisabled(orgId);
  disabledOrgMap.value = { ...disabledOrgMap.value, [orgId]: nextState };
  if (nextState) {
    selectedOrgIds.value = selectedOrgIds.value.filter((id) => id !== orgId);
  }
};

const updateCopyStatus = (orgId: string, status: 'idle' | 'copied' | 'error') => {
  copyStatus.value = { ...copyStatus.value, [orgId]: status };
  if (typeof window === 'undefined') return;
  if (status === 'idle') {
    const timer = copyResetTimers.get(orgId);
    if (timer) {
      window.clearTimeout(timer);
      copyResetTimers.delete(orgId);
    }
    return;
  }
  const duration = status === 'copied' ? 1800 : 3000;
  const existing = copyResetTimers.get(orgId);
  if (existing) {
    window.clearTimeout(existing);
  }
  const timer = window.setTimeout(() => {
    copyResetTimers.delete(orgId);
    copyStatus.value = { ...copyStatus.value, [orgId]: 'idle' };
  }, duration);
  copyResetTimers.set(orgId, timer);
};

const copyOrgIdToClipboard = async (orgId: string) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(orgId);
    } else if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = orgId;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } else {
      throw new Error('Clipboard API is unavailable.');
    }
    updateCopyStatus(orgId, 'copied');
    console.info('Copied organization ID:', orgId);
  } catch (error) {
    console.error('Unable to copy organization ID', error);
    updateCopyStatus(orgId, 'error');
  }
};

const copyLabel = (orgId: string) => {
  const status = copyStatus.value[orgId];
  if (status === 'copied') return 'Copied';
  if (status === 'error') return 'Retry copy';
  return 'Copy ID';
};

const createSlugFromName = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

watch(createOrgName, (name) => {
  if (slugManuallyEdited.value) return;
  createOrgSlug.value = createSlugFromName(name);
});

const ownerSearchTerm = computed(() => createOwnerInput.value.trim().replace(/^@/, ''));
const ownerSearchEligible = computed(
  () => showCreateModal.value && ownerSearchTerm.value.length >= 2 && !uuidPattern.test(ownerSearchTerm.value)
);
const showOwnerSuggestionsHint = computed(
  () =>
    showCreateModal.value &&
    createOwnerInput.value.trim().length > 0 &&
    createOwnerInput.value.trim().length < 2 &&
    !uuidPattern.test(createOwnerInput.value.trim())
);
const showOwnerSuggestionDropdown = computed(
  () =>
    ownerSearchEligible.value &&
    (ownerSuggestionsLoading.value || ownerSuggestions.value.length > 0 || !!ownerSuggestionsError.value)
);

const clearOwnerSuggestions = () => {
  ownerSuggestions.value = [];
  ownerSuggestionsLoading.value = false;
  ownerSuggestionsError.value = null;
  ownerSuggestionIndex.value = -1;
};

const fetchOwnerSuggestions = async (term: string) => {
  ownerSuggestionRequestId += 1;
  const requestId = ownerSuggestionRequestId;
  ownerSuggestionsLoading.value = true;
  ownerSuggestionsError.value = null;
  try {
    const results = await profileService.profiles.searchByUsername(term, 6);
    if (requestId !== ownerSuggestionRequestId) return;
    ownerSuggestions.value = results;
  } catch (error) {
    if (requestId !== ownerSuggestionRequestId) return;
    ownerSuggestions.value = [];
    ownerSuggestionsError.value = error instanceof Error ? error.message : 'Unable to search usernames.';
  } finally {
    if (requestId === ownerSuggestionRequestId) {
      ownerSuggestionsLoading.value = false;
    }
  }
};

const scheduleOwnerSuggestionsFetch = (term: string) => {
  if (ownerSuggestionDebounce) {
    clearTimeout(ownerSuggestionDebounce);
  }
  ownerSuggestionDebounce = setTimeout(() => {
    fetchOwnerSuggestions(term);
  }, 220);
};

watch([ownerSearchTerm, ownerSearchEligible], ([term]) => {
  ownerSuggestionIndex.value = -1;
  if (!ownerSearchEligible.value) {
    clearOwnerSuggestions();
    return;
  }
  scheduleOwnerSuggestionsFetch(term);
});

watch(createOwnerInput, (value) => {
  if (value.trim() !== (ownerIdentifierLock.value ?? '')) {
    ownerIdentifierLock.value = null;
  }
});

watch(showCreateModal, (isOpen) => {
  if (!isOpen && ownerSuggestionDebounce) {
    clearTimeout(ownerSuggestionDebounce);
    ownerSuggestionDebounce = null;
  }
});

const selectOwnerSuggestion = (profile: UserProfile) => {
  createOwnerInput.value = `@${profile.username}`;
  ownerIdentifierLock.value = `@${profile.username}`;
  clearOwnerSuggestions();
};

const moveOwnerSuggestionHighlight = (direction: 1 | -1) => {
  if (!ownerSuggestions.value.length) return;
  const next =
    (ownerSuggestionIndex.value + direction + ownerSuggestions.value.length) % ownerSuggestions.value.length;
  ownerSuggestionIndex.value = next;
};

const handleOwnerInputKeydown = (event: globalThis.KeyboardEvent) => {
  if (!showOwnerSuggestionDropdown.value) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveOwnerSuggestionHighlight(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveOwnerSuggestionHighlight(-1);
  } else if (event.key === 'Enter') {
    if (ownerSuggestionIndex.value >= 0) {
      const suggestion = ownerSuggestions.value[ownerSuggestionIndex.value];
      if (suggestion) {
        event.preventDefault();
        selectOwnerSuggestion(suggestion);
      }
    }
  } else if (event.key === 'Escape') {
    event.preventDefault();
    clearOwnerSuggestions();
  }
};

const resolveOwnerIdentifier = async (identifier: string): Promise<UserProfile> => {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error('Enter an owner username or UUID.');
  }
  const cleaned = trimmed.replace(/^@/, '');
  if (uuidPattern.test(cleaned)) {
    return profileService.profiles.getById(cleaned);
  }
  return profileService.profiles.getByUsername(cleaned);
};

const canSubmitCreate = computed(() => {
  return (
    Boolean(createOrgName.value.trim()) &&
    Boolean(createOrgSlug.value.trim()) &&
    Boolean(createOwnerInput.value.trim()) &&
    !createOrgLoading.value
  );
});

const handleCreateOrgSubmit = async () => {
  if (!canSubmitCreate.value) return;
  createOrgLoading.value = true;
  createOrgError.value = null;
  try {
    const ownerProfile = await resolveOwnerIdentifier(createOwnerInput.value);
    ownerIdentifierLock.value = createOwnerInput.value.trim();

    const payload = {
      name: createOrgName.value.trim(),
      slug: createOrgSlug.value.trim().toLowerCase(),
      owner: ownerProfile.id,
      storage_limit_mb: storageLimitMb.value,
    };

    const created = await orgService.organizations.create(payload);
    await orgList.loadOrganizations();
    createSuccessMessage.value = `${created.name} created.`;
    showCreateModal.value = false;
    resetCreateForm();
  } catch (error) {
    createOrgError.value = error instanceof Error ? error.message : 'Unable to create organization right now.';
  } finally {
    createOrgLoading.value = false;
  }
};

const openDeleteModal = (org: Organization) => {
  orgToDelete.value = org;
  showDeleteModal.value = true;
};

const closeDeleteModal = () => {
  if (!isDeleting.value) {
    showDeleteModal.value = false;
    orgToDelete.value = null;
    orgDeleteError.value = null;
  }
};

const confirmDelete = async () => {
  if (!orgToDelete.value) return;
  isDeleting.value = true;
  orgDeleteError.value = null;
  try {
    await orgService.organizations.deleteById(orgToDelete.value.id);
    await orgList.loadOrganizations();
    showDeleteModal.value = false;
    orgToDelete.value = null;
  } catch (error) {
    orgDeleteError.value = error instanceof Error ? error.message : 'Failed to delete organization.';
  } finally {
    isDeleting.value = false;
  }
};

const handleDelete = (org: Organization) => {
  openDeleteModal(org);
};

const handleBatchDelete = async () => {
  if (!selectedOrgIds.value.length) return;
  if (!window.confirm(`Delete ${selectedOrgIds.value.length} organization(s)? This cannot be undone.`)) {
    return;
  }
  isBatchProcessing.value = true;
  orgDeleteError.value = null;
  try {
    await Promise.all(selectedOrgIds.value.map((orgId) => orgService.organizations.deleteById(orgId)));
    await orgList.loadOrganizations();
    clearOrgSelection();
  } catch (error) {
    orgDeleteError.value = error instanceof Error ? error.message : 'Failed to delete selected organizations.';
  } finally {
    isBatchProcessing.value = false;
  }
};

const handleBatchExport = async () => {
  isBatchProcessing.value = true;
  try {
    console.info('Exporting organizations: ', selectedOrgIds.value);
    await new Promise((resolve) => setTimeout(resolve, 400));
  } finally {
    isBatchProcessing.value = false;
  }
};

const formatDate = (date?: Date | null) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const orgBatchActions = computed<BatchAction[]>(() => [
  {
    id: 'export',
    label: 'Export',
    icon: 'carbon:document-export',
    variant: 'secondary',
    disabled: isBatchProcessing.value,
    onClick: handleBatchExport,
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: 'carbon:trash-can',
    variant: 'primary',
    disabled: isBatchProcessing.value,
    onClick: handleBatchDelete,
  },
]);

watch(
  filteredOrgs,
  (orgs) => {
    const validIds = new Set(orgs.filter((org) => !isOrgDisabled(org.id)).map((org) => org.id));
    selectedOrgIds.value = selectedOrgIds.value.filter((id) => validIds.has(id));
  },
  { immediate: true }
);

onMounted(async () => {
  await Promise.all([orgList.loadOrganizations(), profileList.loadProfiles()]);
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return;
  copyResetTimers.forEach((timer) => window.clearTimeout(timer));
  copyResetTimers.clear();
  if (ownerSuggestionDebounce) {
    clearTimeout(ownerSuggestionDebounce);
    ownerSuggestionDebounce = null;
  }
});
</script>

<template>
  <section class="container-lg space-y-6 py-5 text-white">
    <header class="space-y-1">
      <div>
        <h1 class="text-3xl font-semibold">Organization Directory</h1>
        <p class="text-white/70">Browse, create, or clean up org workspaces.</p>
      </div>
    </header>

    <div class="flex flex-col gap-4 rounded border border-white/10 bg-white/5 p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="relative w-full md:max-w-md">
          <Icon icon="carbon:search" class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search by organization name or slug"
            class="w-full rounded border border-white/20 bg-black/40 py-3 pl-12 pr-4 text-white placeholder:text-white/40 focus:border-white focus:outline-none"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="flex items-center gap-2 rounded border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-black"
            @click="handleCreateOrg"
          >
            <Icon icon="carbon:add" class="h-4 w-4" />
            New org
          </button>
          <RefreshButton size="sm" :refresh="handleRefresh" :loading="orgList.loading.value" title="Refresh organizations" />
        </div>
      </div>

      <div v-if="createSuccessMessage" class="rounded border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
        {{ createSuccessMessage }}
      </div>

      <div v-if="orgList.loading.value" class="rounded border border-white/15 bg-black/30 p-4 text-white/70">
        Loading organizations…
      </div>

      <div v-else-if="orgList.error.value" class="rounded border border-rose-400/40 bg-rose-500/10 p-4 text-white">
        <p class="font-semibold">{{ orgList.error.value }}</p>
        <p class="text-sm text-white/80">Try refreshing or check back later.</p>
      </div>

      <div v-else class="overflow-hidden rounded border border-white/10">
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
                      :disabled="selectableOrgs.length === 0"
                      @change="handleSelectAllChange"
                    />
                    <span class="sr-only">Select all organizations</span>
                  </label>
                </th>
                <th scope="col" class="px-4 py-3">Organization</th>
                <th scope="col" class="px-4 py-3">Slug</th>
                <th scope="col" class="px-4 py-3">Created</th>
                <th scope="col" class="px-4 py-3">Storage (MB)</th>
                <th scope="col" class="px-4 py-3">Status</th>
                <th scope="col" class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredOrgs.length === 0">
                <td colspan="7" class="px-4 py-6 text-center text-white/70">
                  {{ searchQuery ? 'No organizations match your search.' : 'No organizations yet.' }}
                </td>
              </tr>
              <tr
                v-for="org in filteredOrgs"
                :key="org.id"
                :data-state="isOrgDisabled(org.id) ? 'disabled' : isOrgSelected(org.id) ? 'selected' : 'enabled'"
                :aria-disabled="isOrgDisabled(org.id)"
                class="border-b border-white/10 text-white transition-colors last:border-0"
                :class="[
                  isOrgSelected(org.id) ? 'bg-white/10' : 'hover:bg-white/5',
                  isOrgDisabled(org.id) ? 'opacity-50' : 'cursor-pointer'
                ]"
                @click="() => toggleOrgSelection(org.id)"
              >
                <td class="px-4 py-3">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-white/40 bg-transparent"
                    :checked="isOrgSelected(org.id)"
                    :disabled="isOrgDisabled(org.id)"
                    @click.stop
                    @change="() => toggleOrgSelection(org.id)"
                  />
                </td>
                <td class="px-4 py-3">
                  <p class="font-semibold">{{ org.name }}</p>
                  <p class="text-xs text-white/60">
                    Owner:
                    <RouterLink
                      v-if="ownerProfilePath(org.owner)"
                      :to="ownerProfilePath(org.owner)!"
                      class="ml-1 font-semibold text-white/80 underline-offset-2 hover:text-white"
                      @click.stop
                    >
                      {{ ownerPrimaryLabel(org.owner) }}
                    </RouterLink>
                    <span v-else class="ml-1">{{ ownerPrimaryLabel(org.owner) }}</span>
                    <span v-if="ownerSecondaryLabel(org.owner)" class="ml-1 text-white/40">
                      {{ ownerSecondaryLabel(org.owner) }}
                    </span>
                  </p>
                </td>
                <td class="px-4 py-3 font-mono text-sm">
                  {{ org.slug }}
                </td>
                <td class="px-4 py-3">
                  {{ formatDate(org.created_at) }}
                </td>
                <td class="px-4 py-3">
                  {{ org.storage_limit_mb.toLocaleString() }}
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide"
                    :class="isOrgDisabled(org.id) ? 'border-amber-300/50 text-amber-200' : 'border-emerald-300/50 text-emerald-200'"
                  >
                    {{ isOrgDisabled(org.id) ? 'Disabled' : 'Enabled' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-3">
                    <RouterLink
                      :to="`/v2/orgs/${org.slug}/overview`"
                      class="text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
                      @click.stop
                    >
                      View
                    </RouterLink>
                    <RouterLink
                      v-if="ownerProfilePath(org.owner)"
                      :to="ownerProfilePath(org.owner)!"
                      class="text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
                      @click.stop
                    >
                      Owner
                    </RouterLink>
                    <button
                      type="button"
                      class="text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
                      :title="`Copy ID ${org.id}`"
                      @click.stop="() => copyOrgIdToClipboard(org.id)"
                    >
                      {{ copyLabel(org.id) }}
                    </button>
                    <button
                      type="button"
                      class="text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
                      @click.stop="() => toggleOrgDisable(org.id)"
                    >
                      {{ isOrgDisabled(org.id) ? 'Enable' : 'Disable' }}
                    </button>
                    <button
                      type="button"
                      class="text-xs font-semibold uppercase tracking-wide text-rose-300 transition hover:text-rose-100"
                      @click.stop="handleDelete(org)"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <ConfirmDeleteModal
      :show="showDeleteModal"
      :item-name="orgToDelete?.name || ''"
      :is-deleting="isDeleting"
      :popup-title="'Delete Organization'"
      :error="orgDeleteError"
      @confirm="confirmDelete"
      @cancel="closeDeleteModal"
      @close="closeDeleteModal"
    />

    <BatchActionBar
      :selected-count="selectionCount"
      :actions="orgBatchActions"
      @cancel="clearOrgSelection"
    />
  </section>

  <teleport to="body">
    <transition name="create-org-modal">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
        role="dialog"
        aria-modal="true"
        aria-label="Create organization"
        @click.self="closeCreateModal"
      >
        <div class="w-full max-w-xl overflow-hidden rounded-lg border border-white/10 bg-[#0f1016] text-white shadow-2xl">
          <header class="border-b border-white/10 px-6 py-4">
            <p class="text-xs uppercase tracking-wide text-white/50">Create organization</p>
            <h2 class="text-xl font-semibold">Add a new workspace</h2>
          </header>

          <div class="space-y-4 px-6 py-5">
            <div class="space-y-1">
              <label class="text-xs font-semibold uppercase tracking-wide text-white/60" for="create-org-name">
                Organization name
              </label>
              <input
                id="create-org-name"
                v-model="createOrgName"
                type="text"
                autocomplete="off"
                placeholder="Rugby Club"
                class="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-semibold uppercase tracking-wide text-white/60" for="create-org-slug">
                Slug
              </label>
              <input
                id="create-org-slug"
                v-model="createOrgSlug"
                type="text"
                autocomplete="off"
                placeholder="rugby-club"
                class="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                @input="slugManuallyEdited = true"
              />
              <p class="text-xs text-white/50">Used in URLs. We auto-generate it from the name.</p>
            </div>

            <div class="space-y-1">
              <label class="text-xs font-semibold uppercase tracking-wide text-white/60" for="create-org-owner">
                Owner (username or UUID)
              </label>
              <div class="relative">
                <input
                  id="create-org-owner"
                  v-model="createOwnerInput"
                  type="text"
                  autocomplete="off"
                  placeholder="@coach"
                  class="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                  @keydown="handleOwnerInputKeydown"
                />
                <div
                  v-if="showOwnerSuggestionDropdown"
                  class="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded border border-white/15 bg-black/90 text-sm shadow-2xl"
                >
                  <p v-if="ownerSuggestionsLoading" class="px-3 py-2 text-white/60">Searching…</p>
                  <p v-else-if="ownerSuggestionsError" class="px-3 py-2 text-rose-300">
                    {{ ownerSuggestionsError }}
                  </p>
                  <p v-else-if="!ownerSuggestions.length" class="px-3 py-2 text-white/60">No usernames match.</p>
                  <button
                    v-for="(profile, index) in ownerSuggestions"
                    v-else
                    :key="profile.id"
                    type="button"
                    class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-white/10"
                    :class="ownerSuggestionIndex === index ? 'bg-white/10' : ''"
                    @mousedown.prevent="selectOwnerSuggestion(profile)"
                    @mouseenter="ownerSuggestionIndex = index"
                  >
                    <span class="font-semibold">@{{ profile.username }}</span>
                    <span class="text-xs text-white/60">{{ profile.name }}</span>
                  </button>
                </div>
              </div>
              <p v-if="showOwnerSuggestionsHint" class="text-xs text-white/50">
                Type at least 2 characters to search usernames.
              </p>
            </div>

            <div class="space-y-1">
              <label class="text-xs font-semibold uppercase tracking-wide text-white/60" for="create-org-storage">
                Storage limit
              </label>
              <select
                id="create-org-storage"
                v-model.number="storageLimitMb"
                class="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
              >
                <option v-for="option in STORAGE_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>

          <div v-if="createOrgError" class="border-t border-white/10 bg-rose-500/10 px-6 py-3 text-sm text-rose-200">
            {{ createOrgError }}
          </div>

          <div class="flex justify-end gap-3 border-t border-white/10 bg-black/40 px-6 py-4">
            <button
              type="button"
              class="rounded border border-white/30 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
              :disabled="createOrgLoading"
              @click="closeCreateModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded border border-blue-500 bg-blue-600 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canSubmitCreate"
              @click="handleCreateOrgSubmit"
            >
              <span v-if="createOrgLoading" class="flex items-center justify-center gap-2">
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                Creating…
              </span>
              <span v-else>Create org</span>
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.create-org-modal-enter-active,
.create-org-modal-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.create-org-modal-enter-from,
.create-org-modal-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>


<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useRouter } from 'vue-router';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import RefreshButton from '@/components/RefreshButton.vue';
import BatchActionBar, { type BatchAction } from '@/components/ui/tables/BatchActionBar.vue';
import { useOrganizationList } from '@/modules/orgs/composables/useOrganizationsList';
import { orgService } from '@/modules/orgs/services/orgService';
import { useProfilesList } from '@/modules/profiles/composables/useProfileList';
import type { Organization } from '@/modules/orgs/types';
import type { UserProfile } from '@/modules/profiles/types';

const router = useRouter();
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

const handleRefresh = async () => {
  await Promise.all([orgList.loadOrganizations(), profileList.loadProfiles()]);
};

const handleCreateOrg = () => {
  router.push({ name: 'AdminCreateOrg' });
};

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
    icon: 'mdi:tray-arrow-down',
    variant: 'secondary',
    disabled: isBatchProcessing.value,
    onClick: handleBatchExport,
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: 'mdi:trash-can-outline',
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
          <Icon icon="mdi:magnify" class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
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
            <Icon icon="mdi:plus" class="h-4 w-4" />
            New org
          </button>
          <RefreshButton size="sm" :refresh="handleRefresh" :loading="orgList.loading.value" title="Refresh organizations" />
        </div>
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
</template>


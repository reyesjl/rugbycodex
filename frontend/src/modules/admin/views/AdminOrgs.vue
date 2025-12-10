<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useRouter, RouterLink } from 'vue-router';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import RefreshButton from '@/components/RefreshButton.vue';
import { useOrganizationList } from '@/modules/orgs/composables/useOrganizationsList';
import { orgService } from '@/modules/orgs/services/orgService';
import type { Organization } from '@/modules/orgs/types';

const router = useRouter();
const orgList = useOrganizationList();

const orgDeleteError = ref<string | null>(null);
const searchQuery = ref('');

const showDeleteModal = ref(false);
const orgToDelete = ref<Organization | null>(null);
const isDeleting = ref(false);


const handleRefresh = async () => {
  await orgList.loadOrganizations();
};

const handleCreateOrg = () => {
  router.push({ name: 'AdminCreateOrg' });
};

const filteredOrgs = computed(() => {
  if (!searchQuery.value.trim()) {
    return [...orgList.organizations.value];
  }
  const query = searchQuery.value.toLowerCase();
  return orgList.organizations.value.filter(org =>
    org.name.toLowerCase().includes(query)
  );
});

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

const formatDate = (date: Date) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(date);

onMounted(async () => {
  await orgList.loadOrganizations();
});

</script>

<template>
  <section class="container-lg space-y-6 py-5 text-white">
    <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-sm uppercase tracking-wide text-white/60">Admin</p>
        <h1 class="text-3xl font-semibold">Organizations directory</h1>
        <p class="text-white/70">Browse, create, or clean up org workspaces.</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded border border-white/30 px-4 py-2 text-sm font-semibold uppercase tracking-wide hover:bg-white/10"
          @click="handleCreateOrg"
        >
          <Icon icon="mdi:plus" class="mr-2 inline-block" />
          New org
        </button>
        <RefreshButton :refresh="handleRefresh" :loading="orgList.loading.value" title="Refresh organizations" />
      </div>
    </header>

    <div class="relative">
      <Icon icon="mdi:magnify" class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by organization name"
        class="w-full rounded border border-white/20 bg-black/40 py-3 pl-12 pr-4 text-white placeholder:text-white/40 focus:border-white focus:outline-none"
      />
    </div>

    <div v-if="orgList.loading.value" class="rounded border border-white/15 bg-black/30 p-4 text-white/70">
      Loading organizations…
    </div>

    <div v-else-if="orgList.error.value" class="rounded border border-rose-400/40 bg-rose-500/10 p-4 text-white">
      <p class="font-semibold">{{ orgList.error.value }}</p>
      <p class="text-sm text-white/80">Try refreshing or check back later.</p>
    </div>

    <div v-else>
      <ul class="divide-y divide-white/10 rounded border border-white/10">
        <li v-if="filteredOrgs.length === 0" class="py-3 px-4 text-white/60">
          {{ searchQuery ? 'No organizations match your search.' : 'No organizations yet.' }}
        </li>
        <li
          v-for="org in filteredOrgs"
          :key="org.id"
        >
          <div class="group flex items-center justify-between py-3 px-4 transition hover:bg-white hover:text-black">
            <div>
              <RouterLink
                :to="`/v2/orgs/${org.slug}/overview`"
                class="font-semibold group-hover:text-black"
              >
                {{ org.name }}
              </RouterLink>
              <p class="text-sm text-white/70 group-hover:text-black/70">
                Slug: {{ org.slug }} · Created {{ formatDate(org.created_at) }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <RouterLink
                :to="`/v2/orgs/${org.slug}/overview`"
                class="text-xs uppercase tracking-wide text-white/70 transition group-hover:text-black"
              >
                View org
              </RouterLink>
              <button
                type="button"
                class="text-xs uppercase tracking-wide text-rose-400 transition hover:text-rose-200"
                @click="handleDelete(org)"
              >
                Delete
              </button>
            </div>
          </div>
        </li>
      </ul>
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
  </section>
</template>


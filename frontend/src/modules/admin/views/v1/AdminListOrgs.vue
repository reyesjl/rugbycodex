<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import AnimatedLink from '@/components/AnimatedLink.vue';
import { Icon } from '@iconify/vue';
import { useRouter } from 'vue-router';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import RefreshButton from '@/components/RefreshButton.vue';
import { useOrganizationList } from '@/modules/orgs/composables/useOrganizationsList';
import { orgService } from '@/modules/orgs/services/orgService';
import type { Organization } from '@/modules/orgs/types';

const router = useRouter();
const orgList = useOrganizationList();

const orgDeleteError = ref<string | null>(null);
const expandedOrgs = ref<Set<string>>(new Set());
const searchQuery = ref('');

const showDeleteModal = ref(false);
const orgToDelete = ref<Organization | null>(null);
const isDeleting = ref(false);

const toggleExpand = (orgId: string) => {
  if (expandedOrgs.value.has(orgId)) {
    expandedOrgs.value.delete(orgId);
  } else {
    expandedOrgs.value.add(orgId);
  }
};

const isExpanded = (orgId: string) => expandedOrgs.value.has(orgId);

const hasExpandedOrgs = () => expandedOrgs.value.size > 0;

const collapseAll = () => {
  expandedOrgs.value.clear();
};


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

onMounted(async () => {
  await orgList.loadOrganizations();
});

</script>

<template>
  <section class="space-y-6">
    <section
      class="rounded-3xl bg-neutral-100/80 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:bg-neutral-900/70 dark:shadow-[0_40px_80px_rgba(15,23,42,0.35)]">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Organizations</h2>
        <div class="flex items-center gap-2">
          <button v-if="hasExpandedOrgs()" type="button" @click="collapseAll"
            class="rounded-lg p-2 text-neutral-900 transition hover:bg-neutral-200 dark:text-neutral-100 dark:hover:bg-neutral-800"
            title="Collapse all">
            <Icon icon="carbon:collapse-all" class="h-5 w-5" />
          </button>
          <button type="button" @click="handleCreateOrg"
            class="rounded-lg p-2 text-neutral-900 transition hover:bg-neutral-200 dark:text-neutral-100 dark:hover:bg-neutral-800"
            title="Create organization">
            <Icon icon="carbon:add" class="h-5 w-5" />
          </button>
          <RefreshButton :refresh="handleRefresh" :loading="orgList.loading.value" title="Refresh organizations" />
        </div>
      </div>

      <div class="mt-6">
        <div class="relative">
          <Icon icon="carbon:search" class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          <input v-model="searchQuery" type="text" placeholder="Search by organization name..."
            class="w-full rounded-xl border border-neutral-300 bg-white py-3 pl-12 text-neutral-900 transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/20" />
        </div>
      </div>

      <div v-if="filteredOrgs.length === 0 && !orgList.loading.value && !orgList.error.value" class="mt-4">
        <p class="text-neutral-600 dark:text-neutral-400">
          {{ searchQuery ? 'No organizations match your search.' : 'No organizations found.' }}
        </p>
      </div>
      <div v-else-if="orgList.error.value" class="mt-4">
        <p class="text-sm text-rose-500 dark:text-rose-400">Error: {{ orgList.error.value }}</p>
      </div>
      <div v-else class="scrolling-list mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-2">
        <TransitionGroup name="org-list" tag="div" class="space-y-4">
          <div v-for="org in filteredOrgs" :key="org.id"
            class="overflow-hidden rounded-lg border border-neutral-200/60 bg-white/80 transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_12px_40px_rgba(15,23,42,0.35)]">
            <div @click="toggleExpand(org.id)"
              class="flex cursor-pointer items-center justify-between px-3 py-3 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900">
              <div class="flex-1">
                <AnimatedLink :to="`/organizations/${org.slug}`" :text="org.name" @click.stop />
              </div>
              <div class="flex items-center gap-2">
                <button type="button" @click.stop="handleDelete(org)"
                  class="rounded-lg p-2 text-rose-600 transition hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/30"
                  title="Delete organization">
                  <Icon icon="carbon:trash-can" class="h-5 w-5" />
                </button>
                <button type="button" @click.stop="toggleExpand(org.id)"
                  class="rounded-lg p-2 text-neutral-900 transition hover:bg-neutral-200 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  :title="isExpanded(org.id) ? 'Collapse' : 'Expand'">
                  <Icon :icon="isExpanded(org.id) ? 'carbon:chevron-up' : 'carbon:chevron-down'" class="h-5 w-5" />
                </button>
              </div>
            </div>

            <div class="grid transition-all duration-300 ease-in-out"
              :class="isExpanded(org.id) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'">
              <div class="overflow-hidden">
                <div class="space-y-2 border-t border-neutral-200/60 px-3 pb-3 pt-3 dark:border-neutral-800/70">
                  <p class="detail-text">ID: {{ org.id }}</p>
                  <p class="detail-text">Owner ID: {{ org.owner || 'None' }}</p>
                  <p class="detail-text">Slug: {{ org.slug }}</p>
                  <p class="detail-text">Storage Limit: {{ org.storage_limit_mb }} MB</p>
                  <p class="detail-text">Created On: {{ org.created_at.toLocaleString() }}</p>
                </div>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </section>

    <ConfirmDeleteModal :show="showDeleteModal" :item-name="orgToDelete?.name || ''" :is-deleting="isDeleting"
      :popup-title="'Delete Organization'" :error="orgDeleteError" @confirm="confirmDelete" @cancel="closeDeleteModal"
      @close="closeDeleteModal" />
  </section>
</template>

<style scoped>
/* TransitionGroup animation for org deletion */
.org-list-move,
.org-list-enter-active,
.org-list-leave-active {
  transition: all 0.5s ease;
}

.org-list-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.org-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.org-list-leave-active {
  position: absolute;
  width: 100%;
}
</style>

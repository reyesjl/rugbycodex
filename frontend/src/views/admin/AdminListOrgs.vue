<script setup lang="ts">
import { deleteOrganizationById, getAllOrganizations, type Organization } from '@/services/org_service';
import { onMounted, ref } from 'vue';
import AnimatedLink from '@/components/AnimatedLink.vue';
import { Icon } from '@iconify/vue';
import { useRouter } from 'vue-router';
import ErrorNotification from '@/components/ErrorNotification.vue';

const router = useRouter();
const orgs = ref<Organization[]>([]);
const orgLoadError = ref<string | null>(null);
const orgsLoading = ref(true);

const orgDeleteError = ref<string | null>(null);
const expandedOrgs = ref<Set<string>>(new Set());
const refreshSuccess = ref(false);

const toggleExpand = (orgId: string) => {
  if (expandedOrgs.value.has(orgId)) {
    expandedOrgs.value.delete(orgId);
  } else {
    expandedOrgs.value.add(orgId);
  }
};

const isExpanded = (orgId: string) => expandedOrgs.value.has(orgId);

const loadOrganizations = async () => {
  orgsLoading.value = true;
  orgLoadError.value = null;
  try {
    orgs.value = await getAllOrganizations();
  } catch (error: any) {
    orgLoadError.value = error.message || 'Failed to load organizations.';
  } finally {
    orgsLoading.value = false;
  }
};

const handleRefresh = async () => {
  await loadOrganizations();
  refreshSuccess.value = true;
  setTimeout(() => {
    refreshSuccess.value = false;
  }, 1000);
};

const handleCreateOrg = () => {
  router.push({ name: 'AdminCreateOrg' });
};

const handleDelete = (orgId: string) => {
  console.log('Delete organization:', orgId);
  deleteOrganizationById(orgId)
    .then(() => {
      orgDeleteError.value = null;
      loadOrganizations();
    })
    .catch((error: any) => {
      orgDeleteError.value = error.message || 'Failed to delete organization.';
    });
};

onMounted(async () => {
  await loadOrganizations();
});

</script>

<template>
  <section class="base-container container flex min-h-screen flex-col gap-16 pt-32 pb-32">
    <header
      class="rounded-3xl bg-neutral-100/80 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:bg-neutral-900/70 dark:shadow-[0_40px_80px_rgba(15,23,42,0.35)]">
      <p class="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
        Rugbycodex Admin
      </p>
      <h1 class="mt-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Organizations
      </h1>
      <p class="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
        Manage and oversee all organizations within the Rugbycodex platform.</p>
    </header>

    <section
      class="rounded-3xl bg-neutral-100/80 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:bg-neutral-900/70 dark:shadow-[0_40px_80px_rgba(15,23,42,0.35)]">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Current Organizations</h2>
        <div class="flex items-center gap-2">
          <button type="button" @click="handleCreateOrg"
            class="rounded-lg p-2 text-neutral-900 transition hover:bg-neutral-200 dark:text-neutral-100 dark:hover:bg-neutral-800"
            title="Create organization">
            <Icon icon="mdi:plus" class="h-5 w-5" />
          </button>
          <button type="button" @click="handleRefresh" :disabled="orgsLoading"
            class="rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-60" :class="refreshSuccess
              ? 'text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30'
              : 'text-neutral-900 hover:bg-neutral-200 dark:text-neutral-100 dark:hover:bg-neutral-800'"
            title="Refresh organizations">
            <Icon :icon="refreshSuccess ? 'mdi:check' : 'mdi:refresh'" class="h-5 w-5"
              :class="{ 'animate-spin': orgsLoading }" />
          </button>
        </div>
      </div>

      <ErrorNotification :errorMessage="orgDeleteError" @clearError="orgDeleteError = null" />

      <div v-if="orgs.length === 0 && !orgsLoading && !orgLoadError" class="mt-4">
        <p class="text-neutral-600 dark:text-neutral-400">No organizations found.</p>
      </div>
      <div v-else-if="orgLoadError" class="mt-4">
        <p class="text-sm text-rose-500 dark:text-rose-400">Error: {{ orgLoadError }}</p>
      </div>
      <div v-else class="scrolling-list mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-2">
        <div v-for="org in orgs" :key="org.id"
          class="overflow-hidden rounded-lg border border-neutral-200/60 bg-white/80 shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_12px_40px_rgba(15,23,42,0.35)]">
          <div @click="toggleExpand(org.id)"
            class="flex cursor-pointer items-center justify-between px-3 py-3 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900">
            <div class="flex-1">
              <AnimatedLink :to="`/organizations/${org.slug}`" :text="org.name" @click.stop />
            </div>
            <div class="flex items-center gap-2">
              <button type="button" @click.stop="handleDelete(org.id)"
                class="rounded-lg p-2 text-rose-600 transition hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/30"
                title="Delete organization">
                <Icon icon="mdi:trash-can-outline" class="h-5 w-5" />
              </button>
              <button type="button" @click.stop="toggleExpand(org.id)"
                class="rounded-lg p-2 text-neutral-900 transition hover:bg-neutral-200 dark:text-neutral-100 dark:hover:bg-neutral-800"
                :title="isExpanded(org.id) ? 'Collapse' : 'Expand'">
                <Icon :icon="isExpanded(org.id) ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="h-5 w-5" />
              </button>
            </div>
          </div>

          <div class="grid transition-all duration-300 ease-in-out"
            :class="isExpanded(org.id) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'">
            <div class="overflow-hidden">
              <div class="space-y-2 border-t border-neutral-200/60 pt-3 pb-3 px-3 dark:border-neutral-800/70">
                <p class="detail-text">ID: {{ org.id }}</p>
                <p class="detail-text">Owner ID: {{ org.owner || 'None' }}</p>
                <p class="detail-text">Slug: {{ org.slug }}</p>
                <p class="detail-text">Storage Limit: {{ org.storage_limit_mb }} MB</p>
                <p class="detail-text">Created On: {{ org.created_at.toLocaleDateString() }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

  </section>
</template>
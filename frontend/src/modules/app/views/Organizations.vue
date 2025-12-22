<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { orgService } from '@/modules/orgs/services/orgServiceV2';

type UserOrganizationSummary = Awaited<ReturnType<typeof orgService.listUserOrganizations>>[number];

const organizations = ref<UserOrganizationSummary[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const loadOrganizations = async () => {
  loading.value = true;
  error.value = null;
  try {
    organizations.value = await orgService.listUserOrganizations();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load organizations.';
  } finally {
    loading.value = false;
  }
};

onMounted(loadOrganizations);
</script>

<template>
  <section class="container-lg space-y-6 py-5 text-white">
    <header class="space-y-1">
      <h1 class="text-3xl font-semibold">Organizations</h1>
      <p class="text-white/70">
        Discover clubs on Rugbycodex, request to join them, or ask us to spin up a brand new workspace.
      </p>
    </header>

    <div v-if="loading" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Loading organizations…
    </div>

    <div v-else-if="error" class="rounded-lg border border-rose-400/40 bg-rose-500/10 p-6 text-white">
      <p class="font-semibold">Unable to load your organizations.</p>
      <p class="mt-2 text-sm text-white/80">{{ error }}</p>
    </div>

    <div v-else-if="organizations.length === 0" class="rounded-lg border border-white/10 bg-white/5 p-6">
      <p class="text-lg font-semibold">No organizations yet.</p>
      <p class="mt-2 text-sm text-white/70">
        You're not a member of any organizations. Once you join (or we create) one, it will show up here.
      </p>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <RouterLink v-for="entry in organizations" :key="entry.organization.id" :to="`/orgs/${entry.organization.slug}`"
        class="rounded-lg border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
        <div class="flex items-start justify-between gap-3">
          <h2 class="text-xl font-semibold">{{ entry.organization.name }}</h2>
          <span
            class="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70">
            {{ entry.membership.role }}
          </span>
        </div>
        <p class="mt-2 whitespace-pre-line text-sm text-white/70">
          {{ entry.organization.bio ?? 'No bio yet.' }}
        </p>
      </RouterLink>
    </div>
  </section>
</template>

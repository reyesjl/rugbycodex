<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { orgService } from '@/modules/orgs/services/orgServiceV2';
import type { DiscoverableOrganization } from '@/modules/orgs/types/DiscoverableOrganization';
import JoinOrgModal from '@/modules/orgs/components/JoinOrgModal.vue';

const organizations = ref<DiscoverableOrganization[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

// Show join modal
const showJoin = ref(false);


const loadOrganizations = async () => {
  loading.value = true;
  error.value = null;
  try {
    organizations.value = await orgService.listDiscoverableOrganizations();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load organizations.';
  } finally {
    loading.value = false;
  }
};

onMounted(loadOrganizations);
</script>

<template>
  <JoinOrgModal v-if="showJoin" @close="showJoin = false" />
  <section class="container-lg space-y-6 py-5 text-white">
    <header class="space-y-1">
      <div class="flex md:flex-row flex-col items-center justify-between">
        <div class="mb-8 md:mb-0">
          <h1 class="text-3xl">Organizations</h1>
          <p class="text-white/70">
            Find your team, join with a code, or build a new organization.
          </p>
        </div>

        <div class="flex gap-3">
          <button @click="showJoin = true"
            class="flex gap-2 items-center rounded px-2 py-1 border border-sky-500 bg-sky-500/70 hover:bg-sky-700/70 text-xs transition">
            <Icon icon="carbon:join-left-outer" width="15" height="15" />
            <div>Join with code</div>
          </button>

          <RouterLink to="/orgs/create"
            class="flex gap-2 items-center rounded px-2 py-1 border border-green-500 bg-green-500/70 hover:bg-green-700/70 text-xs transition">
            <Icon icon="carbon:add" width="15" height="15" />
            <div>New organization</div>
          </RouterLink>
        </div>
      </div>
    </header>


    <div v-if="loading" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Loading organizations…
    </div>

    <div v-else-if="error" class="rounded-lg border border-rose-400/40 bg-rose-500/10 p-6 text-white">
      <p class="font-semibold">Unable to load organizations.</p>
      <p class="mt-2 text-sm text-white/80">{{ error }}</p>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <RouterLink v-for="org in organizations" :key="org.id" :to="`/orgs/${org.slug}`"
        class="rounded-lg border border-white/10 bg-white/5 p-6 transition hover:bg-white/10">
        <div class="flex items-start justify-between gap-3">
          <h2 class="">{{ org.name }}</h2>

          <!-- OPTIONAL: show whether it's team/union/etc -->
          <span class="rounded-full border border-white/15 bg-black/40 px-3 py-1 
                  text-xs font-semibold uppercase tracking-wide text-white/70">
            {{ org.type || 'ORG' }}
          </span>
        </div>

        <p class="mt-2 whitespace-pre-line text-sm text-white/70">
          {{ org.bio ?? 'No description yet.' }}
        </p>
      </RouterLink>
    </div>
  </section>
</template>

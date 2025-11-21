<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';

// TODO: connect to real org store
// TODO: inject permissions
// TODO: wire search to pgvector
const route = useRoute();
const orgSlug = computed(() => String(route.params.slug ?? 'org'));
const orgName = computed(() => `Org: ${orgSlug.value}`);

const navigation = computed(() => [
  { label: 'Overview', to: `/v2/orgs/${orgSlug.value}/overview`, show: true },
  { label: 'Vaults', to: `/v2/orgs/${orgSlug.value}/vaults`, show: true },
  { label: 'Narrations', to: `/v2/orgs/${orgSlug.value}/narrations`, show: true },
  { label: 'Media', to: `/v2/orgs/${orgSlug.value}/media`, show: true },
  { label: 'Members', to: `/v2/orgs/${orgSlug.value}/members`, show: true },
  { label: 'Settings', to: `/v2/orgs/${orgSlug.value}/settings`, show: true },
  { label: 'Admin Tools', to: `/v2/orgs/${orgSlug.value}/admin`, show: true },
]);

const canSeeMembers = true;
const canSeeSettings = true;
const canSeeAdminTools = true;

const shouldRenderLink = (label: string) => {
  if (label === 'Members') return canSeeMembers;
  if (label === 'Settings') return canSeeSettings;
  if (label === 'Admin Tools') return canSeeAdminTools;
  return true;
};
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white">
      <div class="flex items-center justify-between px-6 py-3">
        <div class="text-sm font-semibold uppercase tracking-wide text-gray-600">Org Workspace</div>
        <div class="flex items-center gap-3">
          <div class="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-800">
            [ No Org Selected ▼ ]
          </div>
          <div class="hidden md:block">
            <input
              type="search"
              placeholder="Search (placeholder)"
              class="w-64 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </div>
          <div class="flex items-center gap-2">
            <div class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-[10px] font-semibold uppercase text-gray-600">
              Bell
            </div>
            <div class="h-9 w-9 rounded-full bg-gray-200" aria-hidden="true" />
          </div>
        </div>
      </div>
    </header>

    <div class="flex min-h-[calc(100vh-56px)]">
      <aside class="w-72 border-r border-gray-200 bg-white px-4 py-6">
        <div class="mb-4">
          <RouterLink
            to="/v2/dashboard"
            class="block rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
          >
            ← Back to Dashboard
          </RouterLink>
        </div>

        <div class="border-b border-gray-200 pb-3 text-sm font-semibold text-gray-700">
          {{ orgName }}
        </div>

        <nav class="mt-4 space-y-2 text-sm font-medium text-gray-800">
          <template v-for="link in navigation" :key="link.to">
            <RouterLink
              v-if="link.show && shouldRenderLink(link.label)"
              :to="link.to"
              class="block rounded-md border border-gray-200 px-4 py-2 transition hover:bg-gray-50"
            >
              {{ link.label }}
            </RouterLink>
          </template>

          <hr class="border-0 border-t border-gray-200" />

          <RouterLink
            to="/v2/profile"
            class="block rounded-md border border-gray-200 px-4 py-2 transition hover:bg-gray-50"
          >
            Profile
          </RouterLink>
        </nav>
      </aside>

      <main class="flex-1 bg-white px-10 py-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { computed, ref } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { Icon } from '@iconify/vue';

const authStore = useAuthStore();

// TODO: wire search to pgvector
// TODO: connect to real org store
const allLinks = [
  { to: '/v2/dashboard', label: 'Dashboard' },
  { to: '/v2/narrations', label: 'My Narrations' },
  { to: '/v2/media', label: 'My Media' },
  { to: '/v2/organizations', label: 'Organizations' },
  { to: '/v2/profile', label: 'Profile' },
  { to: '/v2/settings', label: 'Settings' },
  { to: '/v2/admin', label: 'Admin', condition: authStore.isAdmin },
];
const navLinks = computed(() =>
  allLinks.filter((link) => (link.condition !== undefined ? link.condition : true)),
);

const isNavCollapsed = ref(false);
const toggleNav = () => {
  isNavCollapsed.value = !isNavCollapsed.value;
};

</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white">
      <div class="flex items-center justify-between px-2 py-3">
        <div class="flex items-center gap-3">
          <div class="text-sm font-semibold uppercase tracking-wide text-gray-600">Personal Workspace</div>
          <button @click="toggleNav"
            class="cursor-pointer flex h-6 w-6 items-center justify-center rounded text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            :title="isNavCollapsed ? 'Show sidebar' : 'Hide sidebar'">
            <Icon :icon="isNavCollapsed ? 'carbon:menu' : 'carbon:close'" class="h-4 w-4" />
          </button>
        </div>
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
      <aside v-if="!isNavCollapsed"
        class="w-64 border-r border-gray-200 bg-white px-4 py-6">
        <nav class="space-y-2 text-sm font-medium text-gray-800">
          <RouterLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="block rounded-md border border-gray-200 px-4 py-2 transition hover:bg-gray-50"
          >
            {{ link.label }}
          </RouterLink>
        </nav>
      </aside>

      <main class="flex-1 bg-white px-10 py-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>

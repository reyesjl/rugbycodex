<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { Icon } from '@iconify/vue';

const adminLinks = [
  { to: '/v2/dashboard', label: '← Back to Dashboard' },
  { to: '/v2/admin', label: 'System Overview' },
  { to: '/v2/admin/orgs', label: 'Organizations' },
  { to: '/v2/admin/users', label: 'Users' },
  { to: '/v2/admin/narrations', label: 'Narrations Moderation' },
  { to: '/v2/admin/media', label: 'Media Review' },
  { to: '/v2/admin/jobs', label: 'Jobs / Pipelines' },
  { to: '/v2/admin/billing', label: 'Billing / Metering' },
  { to: '/v2/admin/flags', label: 'Feature Flags' },
  { to: '/v2/admin/experiments', label: 'Experiments' },
  { to: '/v2/profile', label: 'Profile' },
];

const isNavCollapsed = ref(false);
const toggleNav = () => {
  isNavCollapsed.value = !isNavCollapsed.value;
};
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white">
      <div class="flex items-center justify-between px-6 py-3">
        <div class="flex items-center gap-3">
          <div class="text-sm font-semibold uppercase tracking-wide text-gray-600">System Console</div>
          <button @click="toggleNav"
            class="cursor-pointer flex h-6 w-6 items-center justify-center rounded text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            :title="isNavCollapsed ? 'Show sidebar' : 'Hide sidebar'">
            <Icon :icon="isNavCollapsed ? 'carbon:menu' : 'carbon:close'" class="h-4 w-4" />
          </button>
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-600">
          <span class="rounded-md border border-gray-200 px-3 py-1">Admin Mode</span>
        </div>
      </div>
    </header>

    <div class="flex min-h-[calc(100vh-56px)]">
      <aside v-if="!isNavCollapsed"
        class="w-72 border-r border-gray-200 bg-white px-4 py-6 transition-all duration-300">
        <nav class="space-y-2 text-sm font-medium text-gray-800">
          <RouterLink v-for="link in adminLinks" :key="link.to" :to="link.to"
            class="block rounded-md border border-gray-200 px-4 py-2 transition hover:bg-gray-50">
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

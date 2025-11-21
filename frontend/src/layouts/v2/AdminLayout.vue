<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';

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
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900">
    <header class="border-b border-gray-200 bg-white">
      <div class="flex items-center justify-between px-6 py-3">
        <div class="text-sm font-semibold uppercase tracking-wide text-gray-600">System Console</div>
        <div class="flex items-center gap-3 text-xs text-gray-600">
          <span class="rounded-md border border-gray-200 px-3 py-1">Admin Mode</span>
        </div>
      </div>
    </header>

    <div class="flex min-h-[calc(100vh-56px)]">
      <aside class="w-72 border-r border-gray-200 bg-white px-4 py-6">
        <nav class="space-y-2 text-sm font-medium text-gray-800">
          <RouterLink
            v-for="link in adminLinks"
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

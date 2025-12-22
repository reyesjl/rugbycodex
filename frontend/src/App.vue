<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { RouterView } from 'vue-router';
import MainLayout from '@/layouts/MainLayout.vue';
import NullLayout from '@/layouts/v2/NullLayout.vue';
import MarketingLayout from '@/layouts/MarketingLayout.vue';
import AdminLayout from '@/layouts/v2/AdminLayout.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import AppLayout from '@/layouts/v2/AppLayout.vue';
import OrgLayout from '@/layouts/v2/OrgLayout.vue';

const isDarkMode = ref(false);
const legacyStorageKeys = ['betaRequests.csv'];

const cleanupLegacyLocalStorage = () => {
  if (typeof window === 'undefined') return;
  legacyStorageKeys.forEach((key) => {
    if (window.localStorage.getItem(key) !== null) {
      window.localStorage.removeItem(key);
    }
  });
};

const layoutComponents = {
  admin: AdminLayout,
  app: AppLayout,
  main: MainLayout,
  null: NullLayout,
  marketing: MarketingLayout,
  auth: AuthLayout,
  org: OrgLayout,
} as const;

const resolveLayout = (layout?: string) => {
  if (layout === 'null') return layoutComponents.null;
  if (layout === 'marketing') return layoutComponents.marketing;
  if (layout === 'auth') return layoutComponents.auth;
  if (layout === 'app') return layoutComponents.app;
  if (layout === 'org') return layoutComponents.org;
  if (layout === 'admin') return layoutComponents.admin;
  return layoutComponents.main;
};

onMounted(() => {
  cleanupLegacyLocalStorage();
  const saved = localStorage.getItem('darkMode');
  if (saved !== null) {
    isDarkMode.value = JSON.parse(saved);
  } else {
    isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
});

watch(
  isDarkMode,
  (newValue) => {
    if (newValue) {
      document.documentElement.classList.add('dark');
      console.log('Dark mode enabled');
    } else {
      document.documentElement.classList.remove('dark');
      console.log('Dark mode disabled');
    }
    localStorage.setItem('darkMode', JSON.stringify(newValue));
  },
  { immediate: true }
);

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
};
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <component :is="resolveLayout(route.meta.layout as string | undefined)" :toggle-dark-mode="toggleDarkMode">
      <component :is="Component" />
    </component>
  </RouterView>
</template>

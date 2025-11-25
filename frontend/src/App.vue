<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { RouterView } from 'vue-router';
import MainLayout from '@/layouts/MainLayout.vue';
import MinimalLayout from '@/layouts/MinimalLayout.vue';
import MarketingLayout from '@/layouts/v2/MarketingLayout.vue';

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
  main: MainLayout,
  minimal: MinimalLayout,
  marketing: MarketingLayout,
} as const;

const resolveLayout = (layout?: string) => {
  if (layout === 'minimal') return layoutComponents.minimal;
  if (layout === 'marketing') return layoutComponents.marketing;
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
    } else {
      document.documentElement.classList.remove('dark');
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
    <component
      :is="resolveLayout(route.meta.layout as string | undefined)"
      :toggle-dark-mode="toggleDarkMode"
    >
      <component :is="Component" />
    </component>
  </RouterView>
</template>

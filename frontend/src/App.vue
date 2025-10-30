<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { RouterLink, RouterView } from 'vue-router';

// Dark mode reactive state
const isDarkMode = ref(true);

// Load saved preference on mount
onMounted(() => {
  const saved = localStorage.getItem('darkMode');
  if (saved !== null) {
    isDarkMode.value = JSON.parse(saved);
  } else {
    // Default to system preference
    isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
});

// Watch for changes and update DOM + localStorage
watch(isDarkMode, (newValue) => {
  if (newValue) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('darkMode', JSON.stringify(newValue));
}, { immediate: true });

// Toggle function
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
};
</script>

<template>
  <header class="fixed top-0 z-10 block w-full">
    <nav class="container flex justify-around items-center py-8">
      <!-- nav items -->
      <RouterLink class="text-neutral-500 hover:text-black dark:hover:text-white" to="/">Overview</RouterLink>
      <RouterLink class="text-neutral-500 hover:text-black dark:hover:text-white" to="/narrations">Narrations</RouterLink>
      <RouterLink class="text-neutral-500 hover:text-black dark:hover:text-white" to="/vaults">Vaults</RouterLink>
      <RouterLink class="text-neutral-500 hover:text-black dark:hover:text-white" to="/about">About</RouterLink>
    </nav>
  </header>

  <!-- dark mode toggle -->
  <button @click="toggleDarkMode"
    class="fixed bottom-5 right-5 z-50 p-2 rounded-full bg-neutral-400 dark:bg-neutral-800 text-neutral-200 text-xs transition-colors">
    <Icon icon="carbon:brightness-contrast" class="w-4 h-4" />
  </button>

  <main>
    <RouterView />
  </main>

  <footer class="bg-neutral-700 dark:bg-neutral-800 text-neutral-200 pt-16 pb-60 mt-24 text-xs">
    <div class="container mx-auto grid gap-12 md:grid-cols-6 items-start">
      <div class="space-y-4">
        <h2 class="tracking-wide text-neutral-100">Explore</h2>
        <nav class="flex flex-col gap-2 text-neutral-300">
          <RouterLink class="hover:text-white transition-colors" to="/">Overview</RouterLink>
          <RouterLink class="hover:text-white transition-colors" to="/narrations">Narrations</RouterLink>
          <RouterLink class="hover:text-white transition-colors" to="/vaults">Vaults</RouterLink>
          <RouterLink class="hover:text-white transition-colors" to="/about">About</RouterLink>
        </nav>
      </div>

      <div class="md:col-span-3 space-y-4 leading-relaxed text-neutral-300">
        <h2 class="tracking-wide text-neutral-100">About</h2>
        <p>
          Rugbycodex imagines a shared language for the sport; where video, narration, and context meet.
          We’re building a platform that lets clubs and coaches preserve ideas, experiment with tactics,
          and keep institutional knowledge alive for the next season and beyond. Questions? Reach us at
          <a class="underline hover:text-white" href="mailto:contact@biasware.com">contact@biasware.com</a>
        </p>
      </div>

      <div class="md:col-span-2 space-y-4">
        <h2 class="tracking-wide text-neautral-100">Credits</h2>
        <p class="leading-relaxed">
          Built by<br />
          Biasware <a class="text-neutral-400" href="https://biasware.com">Biasware.com</a>
        </p>
        <p class="leading-relaxed">
          Development <br />
          Jose Reyes <a class="text-neutral-400" href="https://biasware.com">@reyesjl</a>
        </p>

        <p class="leading-relaxed">
          Design heavily inspired by <br />

          Jason Yuan <a class="text-neutral-400" href="https://x.com/jasonyuandesign">@jasonyuandesign</a>
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped></style>

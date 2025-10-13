<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import Container from '@/components/Container.vue';
import Section from '@/components/Section.vue';
import AudienceShowcase from '@/components/AudienceShowcase.vue';
import Button from '@/components/Button.vue';
import { Icon } from '@iconify/vue'
import rugbyLogoDark from '@/assets/rugby-logo-dark.svg';
import rugbyLogoLight from '@/assets/rugby-logo-light.svg';
import rugbyWhitepaper from '@/assets/RugbyCodex_Whitepaper.pdf';
import HowItWorks from '@/components/HowItWorks.vue';
import HowCodexHears from '@/components/HowCodexHears.vue';
import Footer from '@/components/Footer.vue';

// Dark mode reactive state
const isDarkMode = ref(false);

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

// Add download function
const downloadWhitepaper = () => {
  const link = document.createElement('a');
  link.href = rugbyWhitepaper;
  link.download = 'RugbyCodex_Whitepaper_2025.pdf';
  link.click();
};

</script>

<template>
  <main class="transition-colors duration-300">

    <!-- Hero section -->
    <Section class="min-h-screen flex items-center">
      <Container class="flex flex-col items-center text-center max-w-4xl">
        <img :src="isDarkMode ? rugbyLogoLight : rugbyLogoDark" alt="Rugby Codex logo" class="max-w-full w-70 mb-6" />

        <h1 class="font-heading text-3xl uppercase tracking-[0.2rem] md:text-5xl">
          Rugby<span class="font-bold">Codex</span>
        </h1>

        <p class="text-lg text-black dark:text-white mb-2 w-full px-2 md:w-3/5">
          It’s the best time in history to understand and enjoy rugby. We are releasing AI driven tools that help
          players learn through data, coaches teach through insight, and unions grow through connection.
        </p>

        <div class="text-gray-500 dark:text-gray-400 text-sm mt-4 space-y-1 max-w-md">
          <p>Educational demonstration showcasing Rugby Codex capabilities.</p>
          <p class="text-xs">Non-commercial use only.</p>
        </div>

        <div
          class="inline-flex items-center bg-neutral-200 dark:bg-neutral-900 px-[.8rem] py-[.2rem] mt-6 text-sm font-mono">
          <span class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
          Beta v1.0.0
        </div>

        <!-- Scroll down icon -->
        <div class="mt-20 flex flex-col items-center gap-1">
          <div class="text-neutral-400">Scroll Down</div>
          <Icon icon="carbon:chevron-down" class="w-6 h-6 text-neutral-400 dark:text-neutral-500 animate-bounce" />
        </div>
      </Container>
    </Section>

    <!-- Dark mode toggle button -->
    <div class="fixed top-4 right-4 z-50">
      <Button @click="toggleDarkMode" variant="toggle" size="sm"
        :aria-label="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'">
        <span v-if="isDarkMode">light</span>
        <span v-else>dark</span>
      </Button>
    </div>

    <!-- Simple CTA Section in the Hero -->
    <Section>
      <Container :class="'flex flex-col gap-2'">
        <div class="flex flex-row items-center gap-1 max-w-fit">Early Access for Your Team
          <Icon icon="carbon:arrow-up-right" class="w-5 h-5 text-green-500" />
        </div>
        <button @click="downloadWhitepaper"
          class="flex flex-row items-center gap-1 max-w-fit text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">
          Download Our Whitepaper 2025
          <Icon icon="carbon:arrow-down" class="w-5 h-5 text-blue-500" />
        </button>
        <button
          class="flex flex-row items-center gap-1 max-w-fit text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">
          Download Narration Guidelines 2025
          <Icon icon="carbon:arrow-down" class="w-5 h-5 text-blue-500" />
        </button>
        <button
          class="flex flex-row items-center gap-1 max-w-fit text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">
          The Annotation Economy Explained
          <Icon icon="carbon:arrow-up-right" class="w-5 h-5 text-orange-500" />
        </button>
        <!-- <div class="flex flex-row items-center gap-1">Ask a Coach
          <Icon icon="carbon:arrow-up-right" class="w-5 h-5 text-orange-500" />
        </div> -->
      </Container>
    </Section>

    <!-- Demo Audience showcase -->
    <AudienceShowcase />

    <!-- How it Works : Upload to Insight Section -->
    <HowItWorks />

    <!-- How Rugby Codex Hears -->
    <HowCodexHears />
  </main>
  <Footer />
</template>

<style scoped></style>

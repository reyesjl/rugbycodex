<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import heroImg from '@/assets/logos/Rugbyball.svg';
import heroWordbox from '@/assets/logos/Rugbycodex.svg';
import videoDemo from '@/assets/videos/HeroDemo.webm';
import rugbyWhitepaper from '@/assets/RugbyCodex_Whitepaper.pdf';

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
  <header class="fixed top-0 z-10 block w-full">
    <nav class="max-w-6xl mx-auto flex justify-around items-center py-8">
      <!-- nav items -->
      <a class="text-neutral-500 hover:text-black dark:hover:text-white" href="#">Overview</a>
      <a class="text-neutral-500 hover:text-black dark:hover:text-white" href="#">Players</a>
      <a class="text-neutral-500 hover:text-black dark:hover:text-white" href="#">Coaches</a>
      <a class="text-neutral-500 hover:text-black dark:hover:text-white" href="#">Contact</a>
    </nav>
  </header>

  <!-- dark mode toggle -->
  <button @click="toggleDarkMode"
    class="fixed bottom-5 right-5 z-50 p-2 rounded-full bg-neutral-400 dark:bg-neutral-800 text-neutral-200 text-xs transition-colors">
    <Icon icon="carbon:brightness-contrast" class="w-4 h-4" />
  </button>

  <!-- Hero section -->
  <section class="hero container mx-auto flex min-h-screen flex-col items-center justify-center">
    <div class="text-neutral-400 mt-auto space-y-4">
      <img :src="heroImg" alt="Rugbycodex" class="lg:mt-20 w-80 md:w-100 lg:w-105 max-w-120 h-auto mx-auto" />
      <img :src="heroWordbox" alt="Rugbycodex" class="w-80 md:w-100 lg:w-105 max-w-120 h-auto mx-auto" />
      <div class="text-center">Public Beta - Version 1.0</div>
    </div>
    <div class="mt-auto mb-20 md:mb-8 flex flex-col justify-end items-center">
      <Icon icon="carbon:arrow-down" class="w-16 h-16 animate-bounce text-neutral-400" />
    </div>
  </section>

  <!-- Overview video -->
  <section class="container mx-auto py-30 flex items-center justify-center">
    <video class="w-80 md:w-3/4 h-auto border-10 md:border-12 border-neutral-700 rounded-xl" :src="videoDemo"
      playsinline autoplay muted loop preload="metadata">
      Your browser does not support the video tag.
    </video>
  </section>

  <!-- Hero statement -->
  <section class="container mx-auto flex items-center justify-center text-center px-4 pb-32">
    <div class="text-neutral-400 text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl max-w-4xl leading-relaxed">
      Rugbycodex is an evolving system for understanding rugby.
      A platform where knowledge, footage, and context
      merge into one fluid language of the game.
    </div>
  </section>


  <section class="container mx-auto w-full md:w-3/4 px-4">
    <div class="micro-grid grid grid-cols-1 md:grid-cols-2 gap-16 text-neutral-900 dark:text-neutral-200">
      <div class="micro">
        <div class="micro-title text-2xl font-semibold">Human-Centered.</div>
        <div class="micro-description text-xl mt-10">Rugbycodex treats analysis as a conversation.
          Every clip, tag, and note is shared understanding between players and coaches.
          We believe technology should reveal the meaning behind play, not replace the human who gives it meaning.</div>
      </div>
      <div class="micro">
        <div class="micro-title text-2xl font-semibold">Dynamic.</div>
        <div class="micro-description text-lg mt-10">RugbyCodex is designed to capture the full context of rugby events.
          The system adapts to how each club, coach, or player learns. It flows naturally between footage, narrations,
          and annotations. We use the vocabulary players and coaches already know.</div>
      </div>
      <div class="micro">
        <div class="micro-title text-2xl font-semibold">Intentional.</div>
        <div class="micro-description text-lg mt-10">The modern rugby ecosystem is noisy. RugbyCodex reduces the clutter
          to the essentials: play, learn,
          reflect. Every feature is designed to minimize friction and maximize insight.</div>
      </div>
      <div class="micro">
        <div class="micro-title text-2xl font-semibold">Collective.</div>
        <div class="micro-description text-lg mt-10">Rugby isn’t built alone. Codex is an archive of intelligence,
          shaped by many voices like yours. Coaches, players, unions, and analysts. It evolves with you and the sport
          itself.
          Each contribution strengthens the shared knowledge of the game.</div>
      </div>
    </div>
  </section>

  <div class="h-1 bg-neutral-400 my-32"></div>

  <section class="container mx-auto w-full md:w-3/4 px-4">
    <div class="chapter flex flex-col justify-center items-center text-neutral-400">
      <div class="text-4xl md:text-6xl text-neutral-400">Enduring</div>
      <div class="text-xl md:text-3xl mt-10 text-center text-neutral-900 dark:text-neutral-200">RugbyCodex preserves coaching
        philosophy, player context, and tactical evolution for the next generation. A permanent digital record of how
        rugby is understood and the nuances of how it's played.</div>

      <a class="md:text-2xl block px-10 py-5 rounded-full !bg-neutral-100 text-neutral-800 dark:!bg-neutral-800 dark:text-neutral-100 mt-10" href="">Learn more about Narrations</a>
    </div>
  </section>
</template>

<style scoped></style>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import heroImg from '@/assets/logos/Rugbyball.svg';
import heroWordbox from '@/assets/logos/Rugbycodex.svg';
import videoDemo from '@/assets/videos/HeroDemo.webm';
import rugbyWhitepaper from '@/assets/RugbyCodex_Whitepaper.pdf';

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
    <nav class="container flex justify-around items-center py-8">
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
  <section class="hero container flex min-h-screen flex-col items-center justify-center">
    <div class="text-neutral-400 mt-auto space-y-4">
      <img :src="heroImg" alt="Rugbycodex"
        class="lg:mt-20 w-80 md:w-100 lg:w-105 max-w-120 h-auto mx-auto animate-pulse" />
      <img :src="heroWordbox" alt="Rugbycodex" class="w-80 md:w-100 lg:w-105 max-w-120 h-auto mx-auto" />
      <div class="text-center">Public Beta - Version 1.0</div>
    </div>
    <div class="mt-auto mb-20 md:mb-8 flex flex-col justify-end items-center">
      <Icon icon="carbon:arrow-down" class="w-16 h-16 animate-bounce text-neutral-400" />
    </div>
  </section>

  <!-- Overview video -->
  <section class="container-lg py-30 flex items-center justify-center">
    <video class="w-80 md:w-3/4 h-auto border-10 md:border-12 border-neutral-700 rounded-xl" :src="videoDemo"
      playsinline autoplay muted loop preload="metadata">
      Your browser does not support the video tag.
    </video>
  </section>

  <!-- Hero statement -->
  <section class="container flex items-center justify-center text-center pb-32">
    <div class="text-neutral-400 text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl max-w-4xl leading-relaxed">
      Rugbycodex is an evolving system for understanding rugby.
      A platform where knowledge, footage, and context
      merge into one fluid language of the game.
    </div>
  </section>

  <!-- Micro features -->
  <section class="container">
    <div class="micro-grid grid grid-cols-1 md:grid-cols-2 gap-16 text-neutral-800 dark:text-neutral-200">
      <div class="micro">
        <div class="micro-line h-1 bg-neutral-300 dark:bg-neutral-800"></div>
        <div class="micro-title text-3xl font-semibold mt-5">Human-Centered.</div>
        <div class="micro-description text-xl mt-10">Rugbycodex treats analysis as a conversation.
          Every clip, tag, and note is shared understanding between players and coaches.
          We believe technology should reveal the meaning behind play, not replace the human who gives it meaning.</div>
      </div>
      <div class="micro">
        <div class="micro-line h-1 bg-neutral-300 dark:bg-neutral-800"></div>
        <div class="micro-title text-3xl font-semibold mt-5">Dynamic.</div>
        <div class="micro-description text-lg mt-10">Rugbycodex is designed to capture the full context of rugby events.
          The system adapts to how each club, coach, or player learns. It flows naturally between footage, narrations,
          and annotations. We use the vocabulary players and coaches already know.</div>
      </div>
      <div class="micro">
        <div class="micro-line h-1 bg-neutral-300 dark:bg-neutral-800"></div>
        <div class="micro-title text-3xl font-semibold mt-5">Intentional.</div>
        <div class="micro-description text-lg mt-10">The modern rugby ecosystem is noisy. Rugbycodex reduces the clutter
          to the essentials: play, learn,
          reflect. Every feature is designed to minimize friction and maximize insight.</div>
      </div>
      <div class="micro">
        <div class="micro-line h-1 bg-neutral-300 dark:bg-neutral-800"></div>
        <div class="micro-title text-3xl font-semibold mt-5">Collective.</div>
        <div class="micro-description text-lg mt-10">Rugby isn’t built alone. Codex is an archive of intelligence,
          shaped by many voices like yours. Unions, coaches, analysts, and players. It evolves with you and the sport
          itself.
          Each contribution strengthens the shared knowledge of the game.</div>
      </div>
    </div>
  </section>

  <!-- Horizontal rule -->
  <div class="h-1 bg-neutral-300 dark:bg-neutral-800 my-32"></div>

  <!-- Enduring section -->
  <section class="container">
    <div class="chapter flex flex-col justify-center items-center text-neutral-400">
      <div class="text-4xl md:text-5xl text-neutral-400">Enduring</div>
      <div class="text-xl md:text-3xl mt-10 text-center text-neutral-900 dark:text-neutral-200">Rugbycodex preserves
        coaching
        philosophy, player context, and tactical evolution for the next generation. A permanent digital record of how
        rugby is understood and the nuances of how it's played.</div>

      <a class="md:text-2xl block px-10 py-5 rounded-full !bg-neutral-100 text-neutral-800 dark:!bg-neutral-800 dark:text-neutral-100 mt-20"
        href="">Learn more about Rugbycodex</a>
    </div>
  </section>


  <!-- Narrations -->
  <section class="container text-neutral-800 dark:text-neutral-200 mt-32">
    <div class="h-1 bg-neutral-300 dark:bg-neutral-800"></div>
    <div class="text-5xl font-semibold mt-5">Narrations</div>
    <p class="text-lg mt-5">Narrations are the foundation of Rugbycodex. Coaches, players, and analysts can add them
      using voice
      or text,
      capturing different angles and insights from each clip. Multiple narrations on a single play create a layered
      understanding of the game. Rugbycodex then analyzes and surfaces the most relevant perspectives for your specific
      purpose.</p>
    <p class="text-sm mt-5 text-neutral-400">Narrations follow principles developed by our rugby experts. Staying
      aligned with these principles strengthens your reputation
      and influence within Rugbycodex.</p>
  </section>

  <!-- Threads -->
  <section class="container text-neutral-800 dark:text-neutral-200 mt-32 mb-32">
    <div class="h-1 bg-neutral-300 dark:bg-neutral-800"></div>
    <div class="text-5xl font-semibold mt-5">Threads</div>
    <p class="text-lg mt-5">Threads connect narrations across moments in time, revealing the flow of a team’s
      development.
      A coach’s comment after a match can link to a player’s reflection in training or an analyst’s pattern report weeks
      later.
      Over time, Rugbycodex weaves these connections into sequences that map progress, decisions, and shared
      understanding across the season.</p>
  </section>

  <!-- Vaults -->
  <section class="container text-neutral-800 dark:text-neutral-200 mb-32">
    <div class="h-1 bg-neutral-300 dark:bg-neutral-800"></div>
    <div class="text-5xl font-semibold mt-5">Vaults</div>
    <p class="text-lg mt-5">Team Vaults are the shared environments where narrations and threads come together.
      Each vault represents a team, academy, or organization within Rugbycodex, forming a private library of clips,
      insights, and evolving knowledge.
      As players and coaches contribute, their vault grows into a living codex that captures the team’s unique identity
      and learning culture.</p>
  </section>

  <!-- Horizontal rule -->
  <div class="h-1 bg-neutral-300 dark:bg-neutral-800 my-32"></div>

  <!-- Patterns section -->
  <section class="container pb-32">
    <div class="chapter flex flex-col justify-center items-center text-neutral-400">
      <div class="text-4xl md:text-5xl text-neutral-400">Patterns in Play</div>
      <div class="text-sm md:text-base mt-2 text-neutral-500 dark:text-neutral-400 text-center">
        A shared intelligence emerging from teams, regions, and unions around the world.
      </div>
      <div class="text-xl md:text-3xl mt-10 text-center text-neutral-900 dark:text-neutral-200">As Vaults expand,
        Rugbycodex will learn from every contribution, finding patterns in play and preparation that have gone unnoticed
        until now.</div>

      <div
        class="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10 text-left text-sm text-neutral-400 w-full max-w-5xl">
        <div class="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
          <h3 class="text-neutral-800 dark:text-neutral-100 font-medium mb-2">United States</h3>
          <p>Regional vaults connect data across New England, Pacific Northwest, and Mid-Atlantic rugby.</p>
        </div>
        <div class="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
          <h3 class="text-neutral-800 dark:text-neutral-100 font-medium mb-2">Europe</h3>
          <p>Insights from Ireland, France, and Wales highlight contrasting development models.</p>
        </div>
        <div class="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
          <h3 class="text-neutral-800 dark:text-neutral-100 font-medium mb-2">Southern Hemisphere</h3>
          <p>Unions like New Zealand, South Africa, and Australia trace evolving tactical philosophies.</p>
        </div>
        <div class="p-4 bg-neutral-100 dark:bg-neutral-800 rounded-2xl">
          <h3 class="text-neutral-800 dark:text-neutral-100 font-medium mb-2">Emerging Regions</h3>
          <p>Access to global
            insights, helping accelerate player development and coaching systems where data has been scarce.</p>
        </div>
      </div>

      <a class="md:text-2xl block px-10 py-5 rounded-full !bg-neutral-100 text-neutral-800 dark:!bg-neutral-800 dark:text-neutral-100 mt-20"
        href="">Be part of the Pattern</a>
    </div>
  </section>

  <footer class="bg-neutral-700 text-neutral-200 pt-16 pb-60 mt-24 text-xs">
    <div class="container mx-auto grid gap-12 md:grid-cols-6 items-start">
      <div class="space-y-4">
        <h2 class="tracking-wide text-neutral-100">Explore</h2>
        <nav class="flex flex-col gap-2 text-neutral-300">
          <a class="hover:text-white transition-colors" href="/">Overview</a>
          <a class="hover:text-white transition-colors" href="/players">Players</a>
          <a class="hover:text-white transition-colors" href="/coaches">Coaches</a>
          <a class="hover:text-white transition-colors" href="/contact">Contact</a>
        </nav>
      </div>

      <div class="md:col-span-3 space-y-4 leading-relaxed text-neutral-300">
        <h2 class="tracking-wide text-neutral-100">About</h2>
        <p>
          Rugbycodex imagines a shared language for the sport; where video, narration, and context meet.
          We’re building a platform that lets clubs and coaches preserve ideas, experiment with tactics,
          and keep institutional knowledge alive for the next season and beyond. Questions? Reach us at
          <a class="underline hover:text-white" href="mailto:contact@biasware.com">contact@biasware.com</a>.
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

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { RouterLink } from 'vue-router';
import NarrationDemo from '@/components/NarrationDemo.vue';
import { CDN_BASE } from '@/lib/cdn';

const heroAnimatedLight = `${CDN_BASE}/static/assets/logos/animated/logo-animation-light.mp4`;
const heroAnimatedDark = `${CDN_BASE}/static/assets/logos/animated/logo-animation-dark.mp4`;
const narrationDemo = `${CDN_BASE}/static/assets/videos/narrationDemo.webm`;
</script>

<template>
  <!-- Hero section -->
  <section class="hero container flex min-h-screen flex-col overflow-x-hidden">
    <div class="flex flex-1 flex-col items-center justify-center space-y-8 text-center">
      <div class="w-full max-w-md overflow-hidden">
        <div class="dark:hidden">
          <div class="mx-auto max-w-lg md:max-w-xl w-full">
            <video
              :src="heroAnimatedLight"
              class="mx-auto w-full"
              playsinline
              autoplay
              muted
              loop
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
        <div class="hidden dark:block">
          <div class="mx-auto max-w-lg md:max-w-xl w-full">
            <video
              :src="heroAnimatedDark"
              class="mx-auto w-full"
              playsinline
              autoplay
              muted
              loop
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </div>
    </div>
    <div class="mt-auto mb-20 flex flex-col items-center justify-end md:mb-8">
      <Icon icon="carbon:arrow-down" class="w-16 h-16 animate-bounce text-neutral-400" />
    </div>
  </section>

  <!-- Overview video -->
  <section class="container-lg py-30 flex items-center justify-center">
    <video class="w-100 md:w-[850px] h-auto rounded-xl" :src="narrationDemo"
      playsinline autoplay muted loop preload="metadata">
      Your browser does not support the video tag.
    </video>
  </section>

  <!-- Hero statement -->
  <section class="container flex items-center justify-center text-center pb-32">
    <div class="text-neutral-400 text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl max-w-4xl leading-relaxed">
      Rugbycodex turns video and footage into searchable knowledge, helping coaches and players see
      patterns, learn faster, and evolve together.
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
        <div class="micro-description text-xl mt-10">Rugbycodex is designed to capture the full context of rugby events.
          The system adapts to how each club, coach, or player learns. It flows naturally between footage and
          narrations. We use the vocabulary players and coaches already know.</div>
      </div>
      <div class="micro">
        <div class="micro-line h-1 bg-neutral-300 dark:bg-neutral-800"></div>
        <div class="micro-title text-3xl font-semibold mt-5">Intentional.</div>
        <div class="micro-description text-xl mt-10">The modern rugby ecosystem is noisy. Rugbycodex reduces the clutter
          to the essentials: play, learn,
          reflect. Every feature is designed to minimize friction and maximize insight.</div>
      </div>
      <div class="micro">
        <div class="micro-line h-1 bg-neutral-300 dark:bg-neutral-800"></div>
        <div class="micro-title text-3xl font-semibold mt-5">Collective.</div>
        <div class="micro-description text-xl mt-10">Rugby isn’t built alone. Codex is an archive of intelligence,
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

      <RouterLink
        to="/inside"
        class="md:text-2xl block px-10 py-5 rounded-full !bg-neutral-100 text-neutral-800 dark:!bg-neutral-800 dark:text-neutral-100 mt-20"
      >
        Learn more about Rugbycodex
      </RouterLink>
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
    <p class="text-sm mt-5 text-neutral-400">*Narrations follow principles developed by our rugby experts. Staying
      aligned with these principles strengthens your reputation
      and influence within Rugbycodex.</p>
    
    <NarrationDemo class="container mt-8" />
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
    <p class="text-lg mt-5">Team vaults are the shared environments where narrations and threads come together.
      Each vault represents a team, academy, or organization within Rugbycodex, forming a private library of clips,
      insights, and evolving knowledge.
      As players and coaches contribute, their vault grows into a living codex that captures the team’s unique identity
      and learning culture.</p>

    <div class="flex justify-center items-center">
      <RouterLink
        to="/auth/signup"
        class="md:text-2xl block px-10 py-5 rounded-full !bg-neutral-100 text-neutral-800 dark:!bg-neutral-800 dark:text-neutral-100 mt-20"
      >
        Make your own team Vault
      </RouterLink>
    </div>
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
        Rugbycodex will learn from every contribution, finding patterns in play and prep across teams and regions.</div>

      <div
        class="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10 text-left text-sm text-neutral-600 dark:text-neutral-400 w-full max-w-5xl">
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

      <RouterLink
        to="/auth/signup"
        class="md:text-2xl block px-10 py-5 rounded-full !bg-neutral-100 text-neutral-800 dark:!bg-neutral-800 dark:text-neutral-100 mt-20"
      >
        Be part of the Pattern
      </RouterLink>
    </div>
  </section>
</template>

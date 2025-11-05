<script setup lang="ts">
import NarrationDemo from '@/components/NarrationDemo.vue';
</script>
<template>
  <!-- Narrations hero section -->
  <section class="hero container flex flex-col justify-center items-center min-h-screen">
    <div class="mt-auto text-5xl md:text-8xl text-sky-600 dark:text-sky-300">Narrations</div>
    <p class="text-xs text-neutral-500">Scroll for a demo of narrations.</p>
    <p class="mb-auto text-center text-xl md:text-2xl mt-20 text-neutral-600 dark:text-neutral-300">No rigid coding. Your voice gives meaning to the footage by explaining or reflecting on what you see. Each narration becomes part of rugby’s shared language.</p>
  </section>

  <!-- Narrations value proposition -->
  <section class="py-20">
    <div class="container mx-auto flex flex-col gap-16 md:flex-row md:items-start md:justify-between">
      <div class="max-w-2xl space-y-6 text-neutral-700 dark:text-neutral-200">
        <h2 class="text-3xl md:text-4xl font-semibold text-neutral-900 dark:text-neutral-50">
          Capture rugby intelligence. Build your team’s voice.
        </h2>
        <p>From elite programmes to emerging clubs, the game is no longer just about drills. It is about reasoning, context, and shared understanding.</p>
        <p>With narrations on Rugbycodex, you can:</p>
        <ul class="space-y-4">
          <li class="flex gap-3">
            <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-sky-500 dark:bg-sky-300"></span>
            <span>Capture coach-led reflections and player voice-over so raw footage becomes team language.</span>
          </li>
          <li class="flex gap-3">
            <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-sky-500 dark:bg-sky-300"></span>
            <span>Layer coach, player, and analyst perspectives on the same moment to surface intent, emotion, and strategy.</span>
          </li>
          <li class="flex gap-3">
            <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-sky-500 dark:bg-sky-300"></span>
            <span>Make every narration searchable so knowledge compounds season after season.</span>
          </li>
        </ul>
      </div>
      <aside
        class="max-w-md space-y-6 rounded-2xl border border-sky-200 bg-white/90 p-10 shadow-lg dark:border-sky-800 dark:bg-neutral-900/80">
        <h3 class="text-2xl font-medium text-neutral-900 dark:text-neutral-100">Why teams lean on narrations</h3>
        <p class="text-neutral-700 dark:text-neutral-300">
          Competitive advantage: the best teams do more than re-run drills, they evolve how they think.
        </p>
        <p class="text-neutral-700 dark:text-neutral-300">
          Cultural clarity: everyone speaks the same team language and understands the why behind the what.
        </p>
        <p class="text-neutral-700 dark:text-neutral-300">
          Growth engine: every season adds to the vault. You are not just coaching today; you are building a legacy.
        </p>
      </aside>
    </div>
  </section>

  <!-- Narration Demo -->
  <div class="container mb-10">
    <NarrationDemo class="container mt-8" />
  </div>

  <p class="container text-center text-sm text-neutral-500 dark:text-neutral-400">
    Stay updated; visit the
    <RouterLink to="/releases"
      class="underline decoration-dotted underline-offset-4 transition hover:text-neutral-900 dark:hover:text-neutral-100">
      Releases page
    </RouterLink>
    often to read about the latest updates.
  </p>
  
</template>
<style lang="css" scoped></style>

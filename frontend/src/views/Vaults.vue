<script setup lang="ts">
</script>
<template>
  <!-- Vaults hero section -->
  <section class="hero container flex flex-col justify-center items-center min-h-screen">
    <div class="mt-auto text-5xl md:text-8xl text-green-600 dark:text-green-300">Vaults</div>
    <p class="mb-auto text-center text-xl md:text-2xl mt-20 text-neutral-600 dark:text-neutral-300">
      Vaults preserve your team’s knowledge and identity. Focus on teaching and learning, not drowning in hours of
      video.
    </p>
  </section>
  <section class="py-20">
    <div class="container mx-auto flex flex-col gap-16 md:flex-row md:items-start md:justify-between">
      <div class="max-w-2xl space-y-6">
        <h2 class="text-3xl md:text-4xl font-semibold text-neutral-700 dark:text-neutral-100">
          Run better sessions with less prep.
        </h2>
        <p class="text-lg text-neutral-700 dark:text-neutral-300">
          Rugbycodex builds your training plans from expert-tagged clips. You can spend less time cutting film and more
          time coaching. Choose a theme or skill area and we’ll surface curated examples, walk-throughs, and live plays
          that reinforce the lesson.
        </p>
        <ul class="space-y-4 text-neutral-700 dark:text-neutral-300">
          <li class="flex gap-3">
            <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-green-500 dark:bg-green-300"></span>
            <span>Auto-generate drills and progressions around your team’s goals.</span>
          </li>
          <li class="flex gap-3">
            <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-green-500 dark:bg-green-300"></span>
            <span>Access proven footage from top coaches and academies.</span>
          </li>
          <li class="flex gap-3">
            <span class="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-green-500 dark:bg-green-300"></span>
            <span>Share sessions with players and staff instantly.</span>
          </li>
        </ul>
      </div>
      <div
        class="max-w-md space-y-6 rounded-2xl border border-green-200 bg-white/90 p-10 shadow-lg dark:border-green-800 dark:bg-neutral-900/80">
        <h3 class="text-2xl font-medium text-neutral-900 dark:text-neutral-100">
          Powered by the best rugby minds
        </h3>
        <p class="text-neutral-700 dark:text-neutral-300">
        Describe the session you want, and Rugbycodex pulls the right instruction, walkthroughs, and live examples from the vaults.
        </p>
        <RouterLink
          to="/inside"
          class="inline-flex items-center justify-center rounded-full bg-green-500 px-6 py-3 text-base font-medium text-white whitespace-nowrap transition hover:bg-green-600">
          Learn more
        </RouterLink>
      </div>
    </div>
  </section>
  <p class="container text-center text-sm text-neutral-500 dark:text-neutral-400">
    Stay updated—visit the
    <RouterLink to="/releases"
      class="underline decoration-dotted underline-offset-4 transition hover:text-neutral-900 dark:hover:text-neutral-100">
      Releases page
    </RouterLink>
    often to read about the latest updates.
  </p>
</template>
<style lang="css" scoped></style>

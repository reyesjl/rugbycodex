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

  <!-- Narration Demo -->
  <div class="container mb-10">
    <NarrationDemo class="container mt-8" />
  </div>

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
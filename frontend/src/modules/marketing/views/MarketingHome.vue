<script setup lang="ts">
// import heroAnimatedLight from '@/assets/logos/animated/logo-animation-light.mp4';
// import heroAnimatedDark from '@/assets/logos/animated/logo-animation-dark.mp4';
import heroImage from '@/assets/modules/marketing/saracens-hero.jpg';
</script>
<template>
  <!-- <section class="min-h-screen grid place-items-center px-4">
    <div class="block dark:hidden">
      <video
        :src="heroAnimatedLight"
        class="block w-full max-w-[720px] h-auto"
        playsinline
        autoplay
        muted
        loop
      />
    </div>
    <div class="hidden dark:block">
      <video
        :src="heroAnimatedDark"
        class="block w-full max-w-[720px] h-auto"
        playsinline
        autoplay
        muted
        loop
      />
    </div>
  </section> -->
  <section class="relative h-screen overflow-hidden">
    <!-- Background video
    <video
      autoplay
      muted
      loop
      playsinline
      class="absolute inset-0 h-full w-full object-cover"
      :src="heroVideo"
    ></video> -->

    <!-- Background image -->
    <img
      :src="heroImage"
      alt="Background"
      class="absolute inset-0 h-full w-full object-cover"
    />

    <!-- Overlay (optional) -->
    <div class="absolute inset-0 bg-black/50"></div>

    <!-- Content -->
    <div class="relative z-10 flex h-full items-end">
      <div class="container-lg pb-20 text-white">
        <h1 class="max-w-3xl text-4xl md:text-6xl">
          Turn rugby footage into searchable moments using your voice.
        </h1>
        <div class="mt-2 text-lg max-w-3xl">Instantly create game reviews, training plans, player highlights, and more.</div>
        <div class="button-set flex gap-5 mt-6 items-center">
          <RouterLink
            to="/v2/marketing"
            class="inline-block bg-white text-black font-semibold px-3 py-1 rounded-full hover:bg-neutral-300"
          >Get Started</RouterLink>
          <RouterLink
            to="/v2/marketing"
            class="hover:underline underline-offset-4 font-semibold"
          >Learn more</RouterLink>
        </div>
      </div>
    </div>

  </section>
  <section class="py-20">
    <div class="container-lg">
      <h2 class="text-4xl">Empowering Rugby Educators Everywhere</h2>
    </div>
  </section>
</template>
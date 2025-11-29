<script setup lang="ts">
// import heroAnimatedLight from '@/assets/logos/animated/logo-animation-light.mp4';
// import heroAnimatedDark from '@/assets/logos/animated/logo-animation-dark.mp4';
import heroImage from '@/assets/modules/marketing/saracens-hero.jpg';
import Button from '@/components/ui/primitives/Button.vue';
import { RouterLink } from 'vue-router';
import razorImg from '@/assets/modules/marketing/razor.jpg';
import pocockImg from '@/assets/modules/marketing/pocock.jpg';
import safaImg from '@/assets/modules/marketing/safa.jpg';
import ImageCell from '@/modules/marketing/components/ImageCell.vue';
import { Icon } from '@iconify/vue';
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
  <section class="relative h-dvh overflow-hidden">
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
    <div class="relative z-10 flex h-full items-end pb-10 md:pb-20">
      <div class="container-lg pb-20 text-white">
        <h1 class="max-w-3xl text-4xl md:text-6xl">
          Turn rugby footage into searchable moments using your voice.
        </h1>
        <div class="mt-5 text-lg max-w-3xl">Instantly create game reviews, training plans, player highlights, and more.</div>
        <div class="button-set flex gap-5 mt-6 items-center">
          <Button size="md">
            GET STARTED
          </Button>
          <RouterLink
            to="/v2/marketing"
            class="hover:underline underline-offset-4"
          >Learn more</RouterLink>
        </div>
      </div>
    </div>
  </section>

  <!-- Three Columns grid -->
  <section class="bg-black p-5">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <ImageCell :src="razorImg" title="Coaching" description="First to know, first to act." :to="'/v2/marketing/coaches'" />
      <ImageCell :src="pocockImg" title="Playing" description="Add IQ to your rugby." :to="'/v2/marketing/players'" />
      <ImageCell :src="safaImg" title="Growing" description="Smarter not harder." :to="'/v2/marketing/unions'" />
    </div>
  </section>

  <section class="py-20 bg-gray-600 text-white">
    <div class="container-lg h-screen">
      <div class="grid grid-cols-1 md:grid-cols-2 items-center">
        <h1 class="text-2xl font-semibold">Codex-1</h1>
        <!-- Make this a link with an underline -->
         <RouterLink
            to="/v2/marketing"
            class="w-fit flex text-sm gap-1 items-center hover:underline underline-offset-4"
          >Rebuild American Rugby <Icon icon="carbon:arrow-up-right" /></RouterLink>
      </div>
    </div>
  </section>
</template>
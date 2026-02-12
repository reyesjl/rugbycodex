<script setup lang="ts">
// const heroAnimatedLight = `${CDN_BASE}/static/assets/logos/animated/logo-animation-light.mp4`;
// const heroAnimatedDark = `${CDN_BASE}/static/assets/logos/animated/logo-animation-dark.mp4`;
import { Icon } from '@iconify/vue';
import Button from '@/components/ui/primitives/Button.vue';
import { RouterLink } from 'vue-router';
import ImageCell from '@/modules/marketing/components/ImageCell.vue';
// import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
// const heroVideo = `${CDN_BASE}/static/assets/modules/marketing/highlights.mp4`;
import BackgroundHighlightPhoto from '../components/BackgroundHighlightPhoto.vue';
import { CDN_BASE } from '@/lib/cdn';

const heroImage = `${CDN_BASE}/static/assets/modules/marketing/saracens-hero.jpg`;
const simonImg = `${CDN_BASE}/static/assets/modules/marketing/simon.jpg`;
const coreyImg = `${CDN_BASE}/static/assets/modules/marketing/corey.png`;
const usawImg = `${CDN_BASE}/static/assets/modules/marketing/usaw.jpg`;
const bgImg = `${CDN_BASE}/static/assets/modules/marketing/mission1.jpg`;

const acknowledgements = [
  'Tony Flay',
  'Grant Keenan',
  'Gabrielle Domina',
  'Benn Mellinger',
  'Eric Shupp',
  'Owen Lentz',
  'Alex Webb',
  'Tim Brown',
  'Simon Cross',
  'Steff Hughes',
  'Joseph Ritter',
  'Aidan Gallagher',
  'Kevin Dougherty',
  'Corey Kroboth',
  'Dom Tom',
  'Jacob Powers',
];
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
          Turn Rugby Footage into Searchable Moments Using Your Voice.
        </h1>
        <div class="mt-5 text-lg max-w-3xl">Better coaching. Player improvement. More wins.</div>
        <div class="button-set flex gap-5 mt-6 items-center">
          <Button size="md" variant="base" color="primary" to="/auth/signup">GET STARTED</Button>
          <RouterLink
            to="/mission"
            class="hover:underline underline-offset-4"
          >Learn more</RouterLink>
        </div>
      </div>
    </div>
  </section>

  <!-- Three Columns grid -->
  <section class="bg-black p-5">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <ImageCell :src="simonImg" title="Coaches" description="Break down film in minutes, not hours." :to="'/coaches'" />
      <ImageCell :src="coreyImg" title="Players" description="Find your strengths. Fix your weaknesses." :to="'/players'" />
      <ImageCell :src="usawImg" title="Unions" description="Build a shared rugby knowledge system." :to="'/unions'" />
    </div>
  </section>

  <section class="py-20 bg-[tan]/40 text-black">
    <div class="container-lg">
      <div class="grid gap-5 grid-cols-1 md:grid-cols-2 items-center pb-10">
        <h1 class="text-2xl font-semibold">Rugbycodex-1 : Origins</h1>
        <!-- Make this a link with an underline -->
         <RouterLink
            to="/mission"
            class="w-fit flex text-sm gap-1 items-center underline underline-offset-4"
          >The Rugby Knowledge Engine <Icon icon="carbon:arrow-up-right" /></RouterLink>
      </div>

      <!-- <BackgroundHighlightVideo
          :srcMp4="herovideo" 
          :highlights="['0:22','1:34','1:52','0:42','0:57']" 
          :bgClass="'bg-tan/40'"
        /> -->
        <BackgroundHighlightPhoto
          :img-src="bgImg" 
        />

      <div class="grid grid-cols-1 md:grid-cols-2 items-center pt-10">
        <div class="flex flex-col">
          <p>Designed by Rugbycodex</p>
          <p>Built Across the Rugby World</p>
        </div>

        <div>The foundation for next-generation rugby analysis, coaching, and pathways.</div>
      </div>
    </div>
  </section>
  <section class="py-20 bg-white">
    <div class="container">
      <h1 class="text-3xl md:text-4xl text-center text-black font-semibold">Acknowledgements</h1>
      <div class="mt-6 space-y-4 text-black">
        <p>
          Rugbycodex exists only because of the people who believed in the idea before it was fully formed, who challenged it, improved it, and helped turn it into something real.
        </p>
        <p>
          Thank you to everyone who contributed their time, knowledge, and perspective along the way. Your feedback, conversations, and encouragement helped shape not just the product, but the thinking behind it.
        </p>
        <p>
          This project was built on shared passion for the game, curiosity about what better analysis can unlock, and the willingness of others to invest energy into something new. That support made the difficult parts possible and the wins meaningful.
        </p>
      </div>
      <div class="mt-6 flex flex-wrap gap-3 text-lg text-black font-semibold">
        <span v-for="name in acknowledgements" :key="name">{{ name }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// const heroAnimatedLight = `${CDN_BASE}/static/assets/logos/animated/logo-animation-light.mp4`;
// const heroAnimatedDark = `${CDN_BASE}/static/assets/logos/animated/logo-animation-dark.mp4`;
import { nextTick, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { animateMini } from 'motion';
import type { DOMKeyframesDefinition } from 'motion';
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

// const acknowledgements = [
//   'Tony Flay',
//   'Grant Keenan',
//   'Gabrielle Domina',
//   'Benn Mellinger',
//   'Eric Shupp',
//   'Owen Lentz',
//   'Alex Webb',
//   'Tim Brown',
//   'Simon Cross',
//   'Steff Hughes',
//   'Joseph Ritter',
//   'Aidan Gallagher',
//   'Kevin Dougherty',
//   'Corey Kroboth',
//   'Dom Tom',
//   'Jacob Powers',
// ];

onMounted(async () => {
  await nextTick();
  const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-hero-motion]'));
  if (!elements.length) return;
  const keyframes: DOMKeyframesDefinition = {
    opacity: [0, 1],
    transform: ['translateY(16px)', 'translateY(0px)'],
  };
  elements.forEach((element, index) => {
    animateMini(element, keyframes, { duration: 0.6, delay: index * 0.12, ease: 'easeOut' });
  });
});
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
    <div class="absolute inset-0 bg-black/70"></div>

    <!-- Content -->
    <div class="relative z-10 flex h-full items-end pb-10 md:pb-20">
      <div class="container-lg pb-20 text-white">
        <h1 data-hero-motion class="max-w-4xl text-5xl md:text-8xl">
          Upload. Talk. <br /> Ask Anything.
        </h1>
        <div data-hero-motion class="mt-5 text-lg max-w-3xl">
          Your voice turns match footage into structured, searchable knowledge.
        </div>
        <div data-hero-motion class="button-set flex gap-5 mt-6 items-center">
          <Button size="lg" variant="base" color="primary" to="/auth/signup">Analyze Your Match</Button>
          <a href="#codex-in-action" class="hover:underline underline-offset-4">See it in Action</a>
        </div>
      </div>
    </div>
  </section>

  <section class="bg-white text-black py-20 space-y-2">
    <div class="container-lg">
      
      <div class="header mb-10">
        <div class="text-3xl md:text-4xl">How Codex Works</div>
      </div>

      <div class="steps-grid grid grid-cols-1 md:grid-cols-2 gap-15 md:gap-20">
      
        <!-- step 1 -->
        <div class="step space-y-5 md:w-3/4">
          <div class="rounded-full bg-black aspect-square h-10 w-10 flex items-center justify-center font-semibold text-white text-lg">1</div>
          <div class="text-lg">
            Start with any existing rugby footage. Upload your matches, opposition film, or even trainings.
          </div>

          <div class="flex flex-col text-xs pl-4 pr-1 py-1 border-l-4 bg-black/5 border-red-500 gap-1">
            <div class="font-semibold">Team Identity</div>
            <div>Gameday is only 10%. The other 90% is learning, developing, and preparing. Codex captures it all, so your team identity isn’t lost between sessions.</div>
          </div>
        </div>

        <!-- step 2 -->
        <div class="step space-y-5 md:w-3/4">
          <div class="rounded-full bg-black aspect-square h-10 w-10 flex items-center justify-center font-semibold text-white text-lg">2</div>

          <div class="text-lg">
            Narrate what you see. Codex turns your expertise into structured, searchable game data.
          </div>

          <div class="flex flex-col text-xs pl-4 pr-1 py-1 border-l-4 bg-black/5 border-amber-500 gap-1">
            <div class="font-semibold">Why Your Voice Matters</div>
            <div>Traditional tools try to guess what happened. Codex listens to what you know happened.</div>
          </div>
        </div>

        <!-- step 3 -->
        <div class="step space-y-5 md:w-3/4">
          <div class="rounded-full bg-black aspect-square h-10 w-10 flex items-center justify-center font-semibold text-white text-lg">3</div>
          <div class="text-lg">
            Ask it anything. Get precise answers backed by your own match context. In seconds, not hours.
          </div>

          <div class="flex flex-col text-xs pl-4 pr-1 py-1 border-l-4 bg-black/5 border-green-500 gap-1">
            <div class="font-semibold">What Coaches Ask</div>
            <ul class="divide-y divide-black/20">
              <li class="py-2">How many breakdowns did we lose inside our 22?</li>
              <li class="py-2">Show every key tackle we missed that led to a try.</li>
              <li class="py-2">Where are we conceding line breaks?</li>
              <li class="py-2">What is New England's biggest weakness?</li>
            </ul>
          </div>
        </div>

        <!-- step 4 -->
        <div class="step space-y-5 md:w-3/4">
          <div class="rounded-full bg-black aspect-square h-10 w-10 flex items-center justify-center font-semibold text-white text-lg">4</div>
          <div class="text-lg">
            Turn insights into coaching adjustments, player feedback, session planning, and match prep.
          </div>

          <div class="flex flex-col text-xs pl-4 pr-1 py-1 border-l-4 bg-black/5 border-blue-500 gap-1">
            <div class="font-semibold">Insight into Action; Talk is Cheap.</div>
            
            <div>Pattern and trend analysis</div>
            
            <ul class="divide-y divide-black/20">
              <li class="py-2 flex items-center">Breakdown trends <Icon icon="carbon:caret-right" /> adjust cleanout roles</li>
              <li class="py-2 flex items-center">Key tackle analysis <Icon icon="carbon:caret-right" /> improve defensive positioning</li>
              <li class="py-2 flex items-center">Line break patterns <Icon icon="carbon:caret-right" /> refine defensive strategies</li>
              <li class="py-2 flex items-center">Opponent weaknesses <Icon icon="carbon:caret-right" /> tailor game plans</li>
            </ul>

          </div>
        </div>
      
      </div>
    </div>
  </section>

  <section id="codex-in-action" class="bg-black text-white py-20">
    <div class="container-lg text-center">
      <div class="text-4xl">See Codex in Action</div>
      <div class="text-lg">From voice to searchable intelligence in under a minute.</div>

      <div class="max-w-6xl mx-auto mt-20">
        <!-- https://cdn.rugbycodex.com/static/assets/videos/demo.mp4 -->
        <video
          muted
          controls
          loop
          playsinline
          class="w-full h-auto object-cover rounded-lg"
          src="https://cdn.rugbycodex.com/static/assets/videos/demo.mp4"
        ></video>
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
</template>

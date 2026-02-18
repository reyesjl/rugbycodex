<script setup lang="ts">
import PageHero from '../components/PageHero.vue';
import HeadlineSlice from '../components/HeadlineSlice.vue';
import BackgroundHighlightPhoto from '../components/BackgroundHighlightPhoto.vue';
import AudienceCTA from '../components/AudienceCTA.vue';
import { CDN_BASE } from '@/lib/cdn';

const bgImg = `${CDN_BASE}/static/assets/modules/marketing/mission2.jpg`;
const bgImg2 = `${CDN_BASE}/static/assets/modules/marketing/mission3.jpg`;

</script>
<template>
  <PageHero
    title-label="Mission"
    title-text="Transforming Rugby Development with Real World Insight."
  />

  <section class="text-white">
    <BackgroundHighlightPhoto
      :img-src="bgImg2" 
    />
  </section>

  <!-- Slice -->
  <HeadlineSlice />

  <section class="bg-white text-white px-4 md:px-8">
    <BackgroundHighlightPhoto
      :img-src="bgImg" 
    />
  </section>

  <!-- Slice 2 -->
  <section class="pt-20 pb-40 bg-white">
    <div class="container-lg">
    <div class="flex flex-col items-center justify-center md:text-9xl text-4xl space-y-2">
        <div>CLARITY</div>
        <div>FOR</div>
        <div>EVERY PHASE</div>
      </div>
    </div>
  </section>

  <section class="px-8 pb-20 bg-white">
    <div class="flex flex-col">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-0 pt-5 pb-10 border-t border-black">
        <div class="text-3xl whitespace-nowrap col-start-1 col-end-2">Our Technology</div>
        <div class="text-xs font-semibold md:text-sm md:font-normal md:col-start-5 md:col-end-7">Insight for the game’s new era.</div>
        <div class="text-sm md:col-start-9 md:col-end-12">Rugbycodex turns match footage into structured, searchable understanding. Using advanced video intelligence, narrations, and a controlled rugby vocabulary, Rugbycodex transform raw clips into real context. It connects players, coaches, and unions through a shared analytical language grounded entirely in real rugby.</div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-0 pt-5 pb-10 border-t border-black">
        <div class="text-3xl whitespace-nowrap col-start-1 col-end-2">Our Business</div>
        <div class="text-xs font-semibold md:text-sm md:font-normal md:col-start-5 md:col-end-7">Rugby intelligence built at speed.</div>
        <div class="text-sm md:col-start-9 md:col-end-12">We build and ship directly with clubs, unions, and players. Instead of waiting for requirements, we solve real performance problems as they appear. Faster reviews, clearer teaching, and standardized terminology. Rugbycodex releases new capabilities in weeks, not seasons, giving rugby organizations modern tools without delay.</div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-0 pt-5 pb-10 border-t border-black">
        <div class="text-3xl whitespace-nowrap col-start-1 col-end-2">Our Team</div>
        <div class="text-xs font-semibold md:text-sm md:font-normal md:col-start-5 md:col-end-7">Builders shaping the future of rugby analysis.</div>
        <div class="text-sm md:col-start-9 md:col-end-12">Our team blends engineers, designers, analysts, and active players who understand rugby on the field and on the screen. We work with coaches across all levels to encode real rugby knowledge into a system anyone can learn from. Every feature is forged from lived experience and data-driven engineering to meet the true needs of the game.</div>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <AudienceCTA
    headline="Help shape the future of rugby intelligence."
    subtext="We’re building this with the people who live the game. If that’s you, let’s talk."
    primary-label="Join the Codex"
    primary-to="/auth/waitlist"
    learn-more-label="Contact Us"
    learn-more-to="mailto:contact@biasware.com"
    bg-color="bg-black"
  />

</template>

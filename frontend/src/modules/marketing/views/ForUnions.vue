<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import herovideo from '@/assets/modules/marketing/highlights.mp4';
import TabSystem from '../components/TabSystem.vue';

const unionSlides = [
  {
    "title": "Regional Performance Map",
    "description": "See how clubs and age groups across your region are progressing. Identify strengths, weaknesses, and trends with unified match footage, narrations, and analytics."
  },
  {
    "title": "Coaching Standards & Development",
    "description": "Give coaches shared tools and shared language. Codex helps standardize terminology, teaching cues, and analysis methods across every team in your Union."
  },
  {
    "title": "Pathways & Talent Pipeline",
    "description": "Identify emerging players across every club and age group. Give selectors clear, time-aligned evidence from real match footage to support pathway decisions."
  },
  {
    "title": "Marketing & Sponsorship Reach",
    "description": "Turn regional footage into polished recap content and highlights for social, sponsors, and community campaigns. Grow visibility and strengthen your Union’s brand."
  }
];


</script>
<template>
  <LandingThreeColumnSection
    title="Unions"
    system-title="Rugby Growth Framework"
    system-code="RGF"
    description="Rugbycodex surfaces regional strengths and weaknesses, highlights emerging talent, and reveals where development resources will make the biggest impact. Unions can benchmark coaching standards, track pathway progress, and quickly generate high-quality highlights to power marketing, sponsorships, and community engagement."
    icon="carbon:chevron-down-outline"
  />
  <section class="text-white">
    <BackgroundHighlightVideo 
      :srcMp4="herovideo" 
      :highlights="['0:22','1:34','1:52','0:42','0:57']" 
      :bgClass="'bg-black'" 
    />
  </section>

  <!-- Tab System -->
  <TabSystem section-title="Core Functions" :slides="unionSlides" />
</template>

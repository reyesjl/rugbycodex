<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import AudienceCTA from '../components/AudienceCTA.vue';
import TabSystem from '../components/TabSystem.vue';
import { CDN_BASE } from '@/lib/cdn';

const herovideo = `${CDN_BASE}/static/assets/modules/marketing/highlights.mp4`;

const unionSlide1 = `${CDN_BASE}/static/assets/modules/marketing/for-unions/slide1.png`;
const unionSlide2 = `${CDN_BASE}/static/assets/modules/marketing/for-unions/slide2.png`;
const unionSlide3 = `${CDN_BASE}/static/assets/modules/marketing/for-unions/slide3.png`;
const unionSlide4 = `${CDN_BASE}/static/assets/modules/marketing/for-unions/slide4.png`;

const unionSlides = [
  {
    "title": "Regional Performance Map",
    "description": "See how clubs and age groups across your region are progressing. Identify strengths, weaknesses, and trends with unified match footage, narrations, and analytics.",
    "mediaSrc": unionSlide1
  },
  {
    "title": "Coaching Standards & Development",
    "description": "Give coaches shared tools and shared language. Codex helps standardize terminology, teaching cues, and analysis methods across every team in your Union.",
    "mediaSrc": unionSlide2
  },
  {
    "title": "Pathways & Talent Pipeline",
    "description": "Identify emerging players across every club and age group. Give selectors clear, time-aligned evidence from real match footage to support pathway decisions.",
    "mediaSrc": unionSlide3
  },
  {
    "title": "Marketing & Sponsorship Reach",
    "description": "Turn regional footage into polished recap content and highlights for social, sponsors, and community campaigns. Grow visibility and strengthen your Union’s brand.",
    "mediaSrc": unionSlide4
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
      :src-mp4="herovideo" 
      :highlights="['0:22','1:34','1:52','0:42','0:57']" 
      :bg-class="'bg-black'" 
    />
  </section>

  <!-- Tab System -->
  <TabSystem section-title="Core Functions" :slides="unionSlides" />

  <!-- CTA -->
  <AudienceCTA
    headline="Build a clearer pathway. Raise the standard."
    subtext="Unify analysis, develop coaches, and surface talent across your region."
    primary-label="Talk With Us"
    primary-to="mailto:contact@biasware.com"
    learn-more-to="/mission"
    bg-color="bg-blue-900"
  />
</template>

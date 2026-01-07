<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import TabSystem from '../components/TabSystem.vue';
import { CDN_BASE } from '@/lib/cdn';

const herovideo = `${CDN_BASE}/static/assets/modules/marketing/highlights.mp4`;

const playerSlide1 = `${CDN_BASE}/static/assets/modules/marketing/for-players/slide1.png`;
const playerSlide2 = `${CDN_BASE}/static/assets/modules/marketing/for-players/slide2.png`;
const playerSlide3 = `${CDN_BASE}/static/assets/modules/marketing/for-players/slide3.png`;
const playerSlide4 = `${CDN_BASE}/static/assets/modules/marketing/for-players/slide4.png`;

const playerSlides = [
  {
    "title": "Personalized Clip Library",
    "description": "Every involvement you make—carry, tackle, pass, breakdown, support—is voice-tagged and grouped. Review your game with clean structure instead of raw footage.",
    "mediaSrc": playerSlide1
  },
  {
    "title": "Guided Rugby Understanding",
    "description": "Hear coach and analyst narrations directly on your actions. Learn the cues, terminology, and decision frameworks used at higher levels—applied to your moments.",
    "mediaSrc": playerSlide2
  },
  {
    "title": "Intelligent Work-Ons Generator",
    "description": "Rugbycodex surfaces patterns from your clips and turns them into clear work-ons. See where you’re improving, where trends repeat, and what to prioritize in training.",
    "mediaSrc": playerSlide3
  },
  {
    "title": "Player Development Timeline",
    "description": "Track your growth across matches. See how your decision-making, involvements, and impact change over time with clean visibility—not guesswork.",
    "mediaSrc": playerSlide4
  }
];

</script>
<template>
  <LandingThreeColumnSection title="Players" system-title="Personal Insight Engine" system-code="Pie"
    description="Players get personalized insight from their own footage — find your strengths, fix your weaknesses, and accelerate your development. see exactly where you can improve through searchable clips, voice-led analysis, and real rugby terminology built with elite coaches."
    icon="carbon:chevron-down-outline" />
  <section class="text-white">
    <BackgroundHighlightVideo 
      :src-mp4="herovideo" 
      :highlights="['0:22', '1:34', '1:52', '0:42', '0:57']" 
      :bg-class="'bg-black'"
    />
  </section>


  <!-- Tab System -->
  <TabSystem section-title="Core Functions" :slides="playerSlides" />
</template>

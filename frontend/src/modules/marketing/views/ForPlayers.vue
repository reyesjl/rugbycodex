<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import herovideo from '@/assets/modules/marketing/highlights.mp4';
import TabSystem from '../components/TabSystem.vue';

const playerSlides = [
  {
    "title": "Personalized Clip Library",
    "description": "Every involvement you make—carry, tackle, pass, breakdown, support—is voice-tagged and grouped. Review your game with clean structure instead of raw footage."
  },
  {
    "title": "Guided Rugby Understanding",
    "description": "Hear coach and analyst narrations directly on your actions. Learn the cues, terminology, and decision frameworks used at higher levels—applied to your moments."
  },
  {
    "title": "Intelligent Work-Ons Generator",
    "description": "Rugbycodex surfaces patterns from your clips and turns them into clear work-ons. See where you’re improving, where trends repeat, and what to prioritize in training."
  },
  {
    "title": "Player Development Timeline",
    "description": "Track your growth across matches. See how your decision-making, involvements, and impact change over time with clean visibility—not guesswork."
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

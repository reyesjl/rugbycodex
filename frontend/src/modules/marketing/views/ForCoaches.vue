<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import TabSystem from '../components/TabSystem.vue';
import herovideo from '@/assets/modules/marketing/highlights.mp4';

const coachSlides = [
  {
    "title": "Searchable Voice Narrations",
    "description": "Record voice notes for training or matches and rugbycodex converts them into searchable insights—time-aligned to your footage and ready for players to review."
  },
  {
    "title": "Layered Clip Breakdown",
    "description": "Rugbycodex auto-tags each clip by phase and lets coaches, analysts, and players add narrations to the same moment, creating stacked perspectives and shared clarity."
  },
  {
    "title": "Predictive Session Planning",
    "description": "Turn your footage into targeted session plans with intelligent suggestions drawn from your own match patterns and recurring trends."
  },
  {
    "title": "Shared Knowledge Network",
    "description": "Share selected clips, narrations, and guides with your coaching group. Your insight scales without extra calls or emails—your network learns from the same moments you do."
  }
];


</script>
<template>
  <LandingThreeColumnSection
    title="Coaches"
    system-title="Tactical Learning System"
    system-code="TLS"
    description="Coaches use rugbycodex to break down matches, teach systems, and build a shared understanding across their teams. Find patterns faster, see moments in context, and turn narrations into clarity that your players can act on."
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
  <TabSystem section-title="Core Functions" :slides="coachSlides" />

</template>

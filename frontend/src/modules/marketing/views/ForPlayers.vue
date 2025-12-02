<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import herovideo from '@/assets/modules/marketing/highlights.mp4';
import TabSystem from '../components/TabSystem.vue';

const playerSlides = [
  {
    "title": "Know Your Game",
    "description": "See every clip you're involved in—cleanly tagged and easy to review. Understand your strengths, fix your weaknesses, and track how you improve over time."
  },
  {
    "title": "Learn From Real Rugby",
    "description": "Review coach and analyst narrations directly on your clips. Hear exactly what they see and learn the terminology and cues used at higher levels."
  },
  {
    "title": "Improve With Guided Reps",
    "description": "Get targeted insights based on your own clips—what to work on, where to focus, and how to transfer it into training. Built from your real match moments."
  }
];

</script>
<template>
  <LandingThreeColumnSection title="Players" system-title="Personal Insight Engine" system-code="Pie"
    description="Players get personalized insight from their own footage — find your strengths, fix your weaknesses, and accelerate your development. see exactly where you can improve through searchable clips, voice-led analysis, and real rugby terminology built with elite coaches."
    icon="carbon:chevron-down-outline" />
  <section class="text-white">
    <BackgroundHighlightVideo 
      :srcMp4="herovideo" 
      :highlights="['0:22', '1:34', '1:52', '0:42', '0:57']" 
      :bgClass="'bg-black'"
    />
  </section>


  <!-- Tab System -->
  <TabSystem section-title="Core Functions" :slides="playerSlides" />
</template>

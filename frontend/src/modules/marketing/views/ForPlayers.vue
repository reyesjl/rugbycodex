<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import herovideo from '@/assets/modules/marketing/highlights.mp4';
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
</template>

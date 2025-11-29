<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import herovideo from '@/assets/modules/marketing/highlights.mp4';

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
</template>

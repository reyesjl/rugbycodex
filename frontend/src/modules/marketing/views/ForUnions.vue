<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import AudienceCTA from '../components/AudienceCTA.vue';
import { CDN_BASE } from '@/lib/cdn';

const herovideo = `${CDN_BASE}/static/assets/modules/marketing/highlights.mp4`;


</script>
<template>
  <LandingThreeColumnSection
    title="Unify Regional Rugby Intelligence."
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

<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import AudienceCTA from '../components/AudienceCTA.vue';
import { CDN_BASE } from '@/lib/cdn';

const herovideo = `${CDN_BASE}/static/assets/modules/marketing/highlights.mp4`;

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
  <!-- CTA -->
  <AudienceCTA
    headline="See your game. Understand your impact."
    subtext="Your footage, your actions, your development. Structured and searchable."
    primary-label="Get Player Access"
    primary-to="/auth/waitlist"
    learn-more-to="/mission"
    bg-color="bg-red-800"
  />
</template>

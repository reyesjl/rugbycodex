<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import AudienceCTA from '../components/AudienceCTA.vue';
import { CDN_BASE } from '@/lib/cdn';

const herovideo = `${CDN_BASE}/static/assets/modules/marketing/highlights.mp4`;


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

  <!-- CTA -->
  <AudienceCTA
    headline="Build a smarter rugby brain for your team."
    subtext="Turn match footage into shared understanding. Teach faster. Align everyone."
    primary-label="Get Coach Access"
    primary-to="/auth/signup"
    learn-more-to="/mission"
    bg-color="bg-zinc-500"
  />

</template>

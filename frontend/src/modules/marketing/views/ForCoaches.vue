<script setup lang="ts">
import LandingThreeColumnSection from '../components/LandingThreeColumnSection.vue';
import BackgroundHighlightVideo from '../components/BackgroundHighlightVideo.vue';
import herovideo from '@/assets/modules/marketing/highlights.mp4';
</script>
<template>
  <LandingThreeColumnSection
    title="Coaches"
    system-title="Team Learning System"
    system-code="TLS"
    description="Coaches use rugbycodex to break down matches, teach systems, and build a shared understanding across their teams. find patterns faster, see moments in context, and turn narrations into clarity that your players can act on."
    icon="carbon:chevron-down-outline"
  />

  <section class="text-white">
    <BackgroundHighlightVideo 
      :srcMp4="herovideo" 
      :highlights="['0:22','1:34','1:52','0:42','0:57']" 
      :bgClass="'bg-black'"
    />
  </section>

  <section>
    <div class="container h-screen">

    </div>
  </section>
</template>

<script setup lang="ts">
import PageHero from '../components/PageHero.vue';
import HeadlineSlice from '../components/HeadlineSlice.vue';
import BackgroundHighlightPhoto from '../components/BackgroundHighlightPhoto.vue';
import bgImg from '@/assets/modules/marketing/mission2.jpg';

</script>
<template>
  <PageHero
    titleLabel="Mission"
    titleText="Transforming Rugby Development with Real World Insight."
  />
  <section class="text-white">
    <BackgroundHighlightPhoto
      :imgSrc="bgImg" 
    />
  </section>
  <HeadlineSlice />

</template>

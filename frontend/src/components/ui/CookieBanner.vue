<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useCookieConsent } from '@/composables/useCookieConsent';

const { shouldShowBanner, dismiss } = useCookieConsent();
const show = computed(() => shouldShowBanner.value);
</script>
<template>
  <div v-if="show"
    class="z-50 text-xs md:text-sm fixed bottom-0 right-0 p-8 text-black bg-white/50 backdrop-blur-sm w-full md:w-1/2 flex flex-col md:flex-row justify-between gap-2 items-center">
    <button type="button" @click="dismiss" aria-label="Dismiss cookie banner"
      class="absolute top-3 right-3 transition-colors">
      <Icon icon="carbon:close" class="w-5 h-5" />
    </button>
    <div class="content pb-4 w-full md:w-2/3 text-center md:text-left">We do NOT use cookies or third-party trackers.</div>
    <!-- <div class="content pb-4 w-full md:w-2/3 text-center md:text-left">We use optional analytics cookies to understand how you use our site so we can improve it. View our Privacy Policy for details.</div> -->
    <!-- <div class="buttons flex gap-2 justify-center">
      <span @click="accept" class="cursor-pointer underline underline-offset-2">Accept</span>|
      <span @click="reject" class="cursor-pointer underline underline-offset-2">Reject</span>
    </div> -->
    <div class="buttons flex gap-2 justify-center">
      <span @click="dismiss" class="cursor-pointer underline underline-offset-2">Dismiss</span>|
    </div>
  </div>
</template>
<style scoped lang="css">
</style>

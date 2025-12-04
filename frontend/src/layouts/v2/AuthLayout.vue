<script setup lang="ts">
import { RouterView } from 'vue-router';
import CookieBanner from '@/components/ui/CookieBanner.vue';

defineProps<{
    toggleDarkMode: () => void;
}>();
</script>

<template>
    <!-- <MarketingNav /> -->
    <CookieBanner />
    <RouterView />
    <!-- <Footer /> -->
</template>

<style scoped>

</style>
<script setup lang="ts">
import { RouterView } from 'vue-router';

import MarketingNav from '@/modules/marketing/components/MarketingNav.vue';
import CookieBanner from '@/components/ui/CookieBanner.vue';
import Footer from '@/modules/marketing/components/Footer.vue';

defineProps<{
    toggleDarkMode: () => void;
}>();
</script>

<template>
    <!-- Can pass dark mode function down to navbar and insert a button there that calls it -->
    <!-- <MarketingNav :toggleDarkMode="toggleDarkMode" /> -->
    <MarketingNav />
    <CookieBanner />
    <RouterView />
    <Footer />
</template>

<style scoped>

</style>

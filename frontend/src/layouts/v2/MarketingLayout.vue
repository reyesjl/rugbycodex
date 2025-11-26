<script setup lang="ts">
import { RouterView } from 'vue-router';

import MarketingNav from '@/modules/marketing/components/MarketingNav.vue';

defineProps<{
    toggleDarkMode: () => void;
}>();
</script>

<template>
    <MarketingNav />

    <RouterView />
</template>

<style scoped>

</style>

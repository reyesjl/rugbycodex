<script setup lang="ts">
import { RouterView } from 'vue-router';

import MarketingNav from '@/components/ui/MarketingNav.vue';

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

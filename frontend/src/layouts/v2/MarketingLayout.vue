<script setup lang="ts">
import { RouterView } from 'vue-router';

import MarketingNav from '@/components/ui/MarketingNav.vue';
</script>

<template>
    <header class="">
      <MarketingNav />
    </header>

    <main>
      <RouterView />
    </main>
</template>

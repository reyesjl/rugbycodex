<script setup lang="ts">
import { useProfileDisplay } from '@/modules/profiles/composables/useProfileDisplay';

const profile = useProfileDisplay();
</script>

<template>
  <section class="space-y-8 text-white">
    <div class="text-2xl">Welcome, {{ profile.displayName }}</div>
  </section>
</template>

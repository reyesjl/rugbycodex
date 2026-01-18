<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthLandingResolution } from '@/modules/app/composables/useAuthLandingResolution';

const { resolveLanding } = useAuthLandingResolution();

// Behavior change: /dashboard is now resolver-only and renders no UI.
onMounted(() => {
  void resolveLanding();
});
</script>

<template>
  <div v-if="false" />
</template>

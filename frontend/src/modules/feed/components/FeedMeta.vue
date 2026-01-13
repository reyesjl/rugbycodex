<script setup lang="ts">
defineProps<{
  title: string;
  metaLine: string;
}>();
</script>

<template>
  <div class="px-4 pt-3">
    <div class="text-white text-base font-semibold leading-snug line-clamp-2">
      {{ title }}
    </div>
    <div class="mt-1 text-xs text-white/60 line-clamp-1">
      {{ metaLine }}
    </div>
  </div>
</template>

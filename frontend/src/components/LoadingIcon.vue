<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
  text?: string
}>()
</script>

<template>
    <div class="flex flex-col items-center gap-4">
      <Icon icon="svg-spinners:ring-resize" class="h-8 w-8 text-neutral-900 dark:text-neutral-100" />
      <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ text || 'Loading...' }}</p>
    </div>
</template>

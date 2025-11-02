<script setup lang="ts">
import { Icon } from '@iconify/vue';

const props = defineProps<{
  toggleDarkMode: () => void;
}>();
</script>

<template>
  <div>
    <slot />

    <button
      @click="props.toggleDarkMode"
      class="fixed bottom-5 right-5 z-50 rounded-full bg-neutral-400 p-2 text-xs text-neutral-200 transition-colors dark:bg-neutral-800"
      aria-label="Toggle dark mode"
    >
      <Icon icon="carbon:brightness-contrast" class="h-4 w-4" />
    </button>
  </div>
</template>

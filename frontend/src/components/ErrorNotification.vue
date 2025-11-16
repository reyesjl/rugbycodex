<script setup lang="ts">

import { Icon } from '@iconify/vue';

defineProps<{
  errorMessage: string | null;
}>();

const emit = defineEmits<{
  clearError: [];
}>();

</script>

<template>
  <div v-if="errorMessage"
    class="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-900/20">
    <div class="flex items-start gap-3">
      <Icon icon="mdi:alert-circle-outline" class="h-5 w-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
      <div>
        <p class="text-sm font-semibold text-rose-800 dark:text-rose-300">Delete Failed</p>
        <p class="text-sm text-rose-700 dark:text-rose-400 mt-1">{{ errorMessage }}</p>
      </div>
      <button @click="emit('clearError')"
        class="ml-auto rounded-lg p-1 text-rose-600 transition hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/30"
        title="Dismiss">
        <Icon icon="mdi:close" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
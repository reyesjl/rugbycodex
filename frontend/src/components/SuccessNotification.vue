<script setup lang="ts">

import { Icon } from '@iconify/vue';

defineProps<{
  successMessage: string | null;
  successTitle?: string;
}>();

const emit = defineEmits<{
  clearSuccess: [];
}>();

</script>

<template>
  <div v-if="successMessage"
    class="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-900/20">
    <div class="flex items-start gap-3">
      <Icon icon="carbon:checkmark-outline" class="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
      <div>
        <p class="text-sm font-semibold text-green-800 dark:text-green-300">{{ successTitle ?? 'Success' }}</p>
        <p class="text-sm text-green-700 dark:text-green-400 mt-1">{{ successMessage }}</p>
      </div>
      <button @click="emit('clearSuccess')"
        class="cursor-pointer ml-auto rounded-lg p-1 text-green-600 transition hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30"
        title="Dismiss">
        <Icon icon="carbon:close" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

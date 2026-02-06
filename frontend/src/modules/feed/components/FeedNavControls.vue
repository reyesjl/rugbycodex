<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
  canPrev: boolean;
  canNext: boolean;
  currentIndex: number;
  totalCount: number;
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
}>();
</script>

<template>
  <div class="hidden md:flex items-center justify-between px-6 py-3 bg-black border-b border-white/10">
    <button
      type="button"
      class="flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      :disabled="!canPrev"
      @click="emit('prev')"
    >
      <Icon icon="carbon:chevron-left" width="20" height="20" />
      <span class="text-sm font-medium">Previous</span>
    </button>

    <div class="text-sm text-white/60 font-medium">
      {{ currentIndex + 1 }} / {{ totalCount }}
    </div>

    <button
      type="button"
      class="flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      :disabled="!canNext"
      @click="emit('next')"
    >
      <span class="text-sm font-medium">Next</span>
      <Icon icon="carbon:chevron-right" width="20" height="20" />
    </button>
  </div>
</template>

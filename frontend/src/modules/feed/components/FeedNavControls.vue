<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed } from 'vue';

const props = defineProps<{
  canPrev: boolean;
  canNext: boolean;
  currentIndex: number;
  totalCount: number;
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
}>();

// Create segments for each item
const segments = computed(() => {
  const items = [];
  for (let i = 0; i < props.totalCount; i++) {
    items.push({
      index: i,
      isComplete: i < props.currentIndex,
      isActive: i === props.currentIndex,
    });
  }
  return items;
});
</script>

<template>
  <div class="hidden md:flex items-center gap-4 px-6 py-3 bg-black border-b border-white/10">
    <button
      type="button"
      class="flex items-center gap-2 px-3 py-2 rounded-lg text-white bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      :disabled="!canPrev"
      @click="emit('prev')"
    >
      <Icon icon="carbon:chevron-left" width="20" height="20" />
      <span class="text-sm font-medium">Previous</span>
    </button>

    <!-- Progress Bar (same as mobile) -->
    <div class="flex-1 flex gap-1">
      <div
        v-for="segment in segments"
        :key="segment.index"
        class="flex-1 h-0.5 rounded-full overflow-hidden bg-white/20"
      >
        <div
          class="h-full transition-all duration-300 ease-out"
          :class="[
            segment.isComplete || segment.isActive ? 'bg-white' : 'bg-transparent',
            segment.isActive ? 'w-full' : segment.isComplete ? 'w-full' : 'w-0'
          ]"
        />
      </div>
    </div>

    <button
      type="button"
      class="flex items-center gap-2 px-3 py-2 rounded-lg text-white bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      :disabled="!canNext"
      @click="emit('next')"
    >
      <span class="text-sm font-medium">Next</span>
      <Icon icon="carbon:chevron-right" width="20" height="20" />
    </button>
  </div>
</template>

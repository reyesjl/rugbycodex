<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  activeIndex: number;
  totalCount: number;
}>();

// Calculate progress percentage
const progressPercent = computed(() => {
  if (props.totalCount === 0) return 0;
  return ((props.activeIndex + 1) / props.totalCount) * 100;
});

// Create segments for each item
const segments = computed(() => {
  const items = [];
  for (let i = 0; i < props.totalCount; i++) {
    items.push({
      index: i,
      isComplete: i < props.activeIndex,
      isActive: i === props.activeIndex,
    });
  }
  return items;
});
</script>

<template>
  <div class="w-full px-3 pt-2 pb-0.5">
    <div class="flex gap-1">
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
  </div>
</template>

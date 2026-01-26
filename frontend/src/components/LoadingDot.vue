<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { Icon } from '@iconify/vue';

interface Props {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
  speed?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  color: 'text-white/60',
  speed: 400,
});

const state = ref<0 | 1 | 2>(0);
let intervalId: number | null = null;

const iconSizes = {
  xs: '12px',
  sm: '16px',
  md: '20px',
  lg: '24px',
};

const iconSize = computed(() => iconSizes[props.size]);

const currentIcon = computed(() => {
  // State 0: Solid dot
  if (state.value === 0) return 'fluent-mdl2:location-dot';
  // State 1: Circle with dot
  if (state.value === 1) return 'stash:circle-dot';
  // State 2: Hollow circle (circle-dot-light)
  return 'stash:circle-dot-light';
});

function cycleState() {
  state.value = ((state.value + 1) % 3) as 0 | 1 | 2;
}

onMounted(() => {
  intervalId = window.setInterval(cycleState, props.speed);
});

onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
});
</script>

<template>
  <div class="loading-dot inline-flex items-center justify-center">
    <Icon
      :icon="currentIcon"
      :class="color"
      :style="{ fontSize: iconSize }"
      class="transition-opacity duration-150"
    />
  </div>
</template>

<style scoped>
.loading-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>

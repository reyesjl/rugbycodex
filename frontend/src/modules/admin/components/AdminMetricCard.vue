<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed } from 'vue';

interface Props {
  label: string;
  description: string;
  value: number | string;
  icon: string;
  loading?: boolean;
  status?: 'normal' | 'warning' | 'danger';
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  status: 'normal',
});

const statusClasses = computed(() => {
  if (props.status === 'warning') {
    return 'border-yellow-500/30 bg-yellow-500/10';
  }
  if (props.status === 'danger') {
    return 'border-red-500/30 bg-red-500/10';
  }
  return 'border-white/10 bg-white/5';
});

const valueClasses = computed(() => {
  if (props.status === 'warning') {
    return 'text-yellow-300';
  }
  if (props.status === 'danger') {
    return 'text-red-300';
  }
  return 'text-white';
});
</script>

<template>
  <div class="relative rounded-lg border p-4 transition-colors" :class="statusClasses">
    <div class="flex items-start justify-between gap-2">
      <div class="flex-1 min-w-0">
        <div class="text-[10px] uppercase tracking-[0.2em] text-white/40">{{ label }}</div>
        <div class="mt-1 text-xs text-white/60">{{ description }}</div>
      </div>
      <Icon :icon="icon" class="h-4 w-4 text-white/30 flex-shrink-0" />
    </div>
    <div class="mt-3">
      <div v-if="loading" class="h-8 w-16 animate-pulse rounded bg-white/10"></div>
      <div v-else class="text-2xl font-semibold" :class="valueClasses">
        {{ value }}
      </div>
    </div>
  </div>
</template>

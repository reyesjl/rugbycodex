<script setup lang="ts">
import { computed } from 'vue';

type PillVariant = 'default' | 'warning' | 'danger' | 'success' | 'info';

const props = withDefaults(
  defineProps<{
    variant?: PillVariant;
  }>(),
  {
    variant: 'default',
  }
);

const variantClasses: Record<PillVariant, string> = {
  default: 'border-neutral-200 text-neutral-700 dark:border-white/70 dark:text-white',
  warning: 'border-amber-500 text-amber-500',
  danger: 'border-rose-500 text-rose-500',
  success: 'border-green-500 text-green-500',
  info: 'border-blue-500 text-blue-500',
};

const classes = computed(() => variantClasses[props.variant]);
</script>

<template>
  <span
    class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
    :class="classes"
  >
    <slot />
  </span>
</template>

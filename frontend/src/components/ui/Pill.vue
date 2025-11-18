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
  warning:
    'border-amber-600 text-amber-700 dark:border-amber-300 dark:text-amber-200',
  danger:
    'border-rose-600 text-rose-700 dark:border-rose-300 dark:text-rose-200',
  success:
    'border-emerald-600 text-emerald-700 dark:border-emerald-300 dark:text-emerald-200',
  info: 'border-blue-600 text-blue-700 dark:border-blue-300 dark:text-blue-200',
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

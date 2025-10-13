<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    as?: keyof HTMLElementTagNameMap;
    padding?: string;
    class?: string | string[] | Record<string, boolean>;
    variant?: 'light' | 'dark';
  }>(),
  {
    as: 'section',
    padding: 'py-12 md:py-16',
    variant: 'light',
  }
);

// Computer background classes based on varient
const backgroundClasses = computed(() => {
  return props.variant === 'light'
    ? 'bg-white text-black dark:bg-black dark:text-white'
    : 'bg-black text-white dark:bg-white dark:text-black';
});

</script>

<template>
  <component
    :is="props.as"
    :class="[
      'section',
      backgroundClasses,
      'transition-colors duration-300',
      props.padding,
      props.class,
    ]"
  >
    <slot />
  </component>
</template>

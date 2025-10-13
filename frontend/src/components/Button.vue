<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'selected' | 'toggle'
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md'
})

const classes = computed(() => {
  const base = 'cursor-pointer transition-all duration-200 rounded-xs'
  
  const sizes = {
    sm: 'py-[.1rem] px-[.5rem]',
    md: 'py-[.2rem] px-[.8rem]'
  }
  
  const variants = {
    default: 'text-current hover:bg-white hover:text-black hover:border-neutral-300 dark:hover:bg-black dark:hover:text-white dark:hover:border-neutral-600 border border-transparent',
    selected: 'bg-white text-black dark:bg-black dark:text-white border border-neutral-300 dark:border-neutral-600',
    toggle: 'bg-neutral-200 text-black dark:bg-neutral-800 dark:text-white transition-colors duration-300'
  }
  
  return `${base} ${sizes[props.size]} ${variants[props.variant]}`
})
</script>

<template>
  <button :class="classes">
    <slot />
  </button>
</template>
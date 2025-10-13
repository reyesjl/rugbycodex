<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    as?: keyof HTMLElementTagNameMap;
    class?: string | string[] | Record<string, boolean>;
  }>(),
  {
    as: 'div'
  }
);
</script>

<template>
  <component
    :is="props.as"
    :class="['container mx-auto px-4 md:px-6 lg:px-8', props.class]"
  >
    <slot />
  </component>
</template>

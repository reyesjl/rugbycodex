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
    :class="['container', props.class]"
  >
    <slot />
  </component>
</template>

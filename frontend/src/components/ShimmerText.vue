<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string;
    as?: 'span' | 'div' | 'p';
  }>(),
  {
    text: '',
    as: 'span',
  }
);
</script>

<template>
  <component :is="as" class="shimmer-text">
    <slot>{{ text }}</slot>
  </component>
</template>

<style scoped>
.shimmer-text {
  position: relative;
  display: inline-block;
  background-image: linear-gradient(
    110deg,
    rgba(255, 255, 255, 0.25) 0%,
    rgba(255, 255, 255, 0.65) 30%,
    rgba(255, 255, 255, 0.25) 60%
  );
  background-size: 200% 100%;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: shimmer-text 1.6s linear infinite;
}

@keyframes shimmer-text {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .shimmer-text {
    animation: none;
    background-position: 50% 0;
  }
}
</style>

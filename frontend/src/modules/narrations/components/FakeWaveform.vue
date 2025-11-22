<script setup lang="ts">
const props = defineProps<{
  isRecording: boolean;
}>();
</script>

<template>
  <!-- Waveform animation shown only while recording -->
  <div v-if="props.isRecording" class="waveform" aria-hidden="true">
    <span class="bar"></span>
    <span class="bar"></span>
    <span class="bar"></span>
    <span class="bar"></span>
  </div>

</template>

<style scoped>
.waveform {
  display: inline-flex;
  gap: 6px;
  align-items: flex-end;
  height: 18px;
}

.waveform .bar {
  width: 4px;
  height: 6px;
  background-color: #2563eb;
  /* Tailwind blue-600 */
  border-radius: 2px;
  transform-origin: bottom;
  animation: waveform-bounce 800ms ease-in-out infinite;
}

.waveform .bar:nth-child(1) {
  animation-delay: 0ms;
}

.waveform .bar:nth-child(2) {
  animation-delay: 120ms;
}

.waveform .bar:nth-child(3) {
  animation-delay: 240ms;
}

.waveform .bar:nth-child(4) {
  animation-delay: 360ms;
}

.waveform .bar:nth-child(5) {
  animation-delay: 480ms;
}

@keyframes waveform-bounce {
  0% {
    transform: scaleY(0.25);
  }

  50% {
    transform: scaleY(1);
  }

  100% {
    transform: scaleY(0.35);
  }
}

/* Respect reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .waveform .bar {
    animation: none;
    height: 8px;
  }
}
</style>
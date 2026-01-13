<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

/**
 * Transparent gesture layer.
 * Emits semantic events only; does not know about media/narration.
 */

const emit = defineEmits<{
  (e: 'tap'): void;
  (e: 'swipeUp'): void;
  (e: 'swipeDown'): void;
}>();

const SWIPE_PX = 50;

const pointerDown = ref(false);
let startX = 0;
let startY = 0;
let startAt = 0;

function onPointerDown(e: PointerEvent) {
  pointerDown.value = true;
  startX = e.clientX;
  startY = e.clientY;
  startAt = Date.now();
}

function onPointerMove() {
  if (!pointerDown.value) return;
}

function finishPointer(e: PointerEvent) {
  if (!pointerDown.value) return;
  pointerDown.value = false;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const elapsed = Date.now() - startAt;

  // Swipe vertical navigation.
  if (absY >= SWIPE_PX && absY > absX * 1.2) {
    if (dy < 0) emit('swipeUp');
    else emit('swipeDown');
    return;
  }

  // Tap (quick, minimal movement)
  if (elapsed < 500 && absX < SWIPE_PX && absY < SWIPE_PX) {
    emit('tap');
  }
}

function onPointerUp(e: PointerEvent) {
  finishPointer(e);
}

function onPointerCancel(e: PointerEvent) {
  finishPointer(e);
}

onBeforeUnmount(() => {
});
</script>

<template>
  <!-- touch-action none so we can interpret swipes without browser scroll/pinch interference on the video surface -->
  <div
    class="absolute inset-0"
    :class="['touch-none', 'md:touch-pan-y']"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <!-- Slot is where overlay UI lives (controls, record button, etc). -->
    <slot />
  </div>
</template>

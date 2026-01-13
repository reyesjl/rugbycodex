<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

/**
 * Transparent gesture layer.
 * Emits semantic events only; does not know about media/narration.
 */

const emit = defineEmits<{
  (e: 'tap', payload: { pointerType: PointerEvent['pointerType'] }): void;
  (e: 'swipeUp'): void;
  (e: 'swipeDown'): void;
}>();

const SWIPE_PX = 50;

const pointerDown = ref(false);
let startX = 0;
let startY = 0;
let startAt = 0;
let startPointerType: PointerEvent['pointerType'] = 'touch';

function shouldIgnoreGestureTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a, input, textarea, select, [role="button"], [data-gesture-ignore]'));
}

function onPointerDown(e: PointerEvent) {
  // If the user is interacting with overlay controls (buttons, inputs, etc),
  // don't treat it as a tap/swipe on the video surface.
  if (shouldIgnoreGestureTarget(e.target)) return;
  pointerDown.value = true;
  startX = e.clientX;
  startY = e.clientY;
  startAt = Date.now();
  startPointerType = e.pointerType;
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
    emit('tap', { pointerType: startPointerType });
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

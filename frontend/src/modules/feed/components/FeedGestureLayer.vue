<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

/**
 * Transparent gesture layer.
 * Emits semantic events only; does not know about media/narration.
 */

const emit = defineEmits<{
  (e: 'tap', payload: {
    pointerType: PointerEvent['pointerType'];
    xPct: number;
    yPct: number;
  }): void;
  (e: 'swipeUp'): void;
  (e: 'swipeDown'): void;
  (e: 'swipeLeft'): void;
  (e: 'swipeRight'): void;
}>();

const SWIPE_PX = 50;

const pointerDown = ref(false);
let startX = 0;
let startY = 0;
let startAt = 0;
let startPointerType: PointerEvent['pointerType'] = 'touch';
let startTarget: EventTarget | null = null;

function shouldIgnoreGestureTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, a, input, textarea, select, [role="button"], [data-gesture-ignore]'));
}

function onPointerDown(e: PointerEvent) {
  // If the user is interacting with overlay controls (buttons, inputs, etc),
  // don't treat it as a tap/swipe on the video surface.
  if (shouldIgnoreGestureTarget(e.target)) return;
  pointerDown.value = true;
  startTarget = e.target;
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

  // Ignore if either the start or end target should be ignored
  // This handles cases where the pointer moved between down and up
  if (shouldIgnoreGestureTarget(startTarget) || shouldIgnoreGestureTarget(e.target)) {
    startTarget = null;
    return;
  }

  const el = e.currentTarget as HTMLElement | null;
  const rect = el?.getBoundingClientRect?.() ?? null;
  const xPct = rect && rect.width ? Math.max(0, Math.min(1, (startX - rect.left) / rect.width)) : 0.5;
  const yPct = rect && rect.height ? Math.max(0, Math.min(1, (startY - rect.top) / rect.height)) : 0.5;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const elapsed = Date.now() - startAt;

  startTarget = null;

  // Swipe vertical navigation.
  if (absY >= SWIPE_PX && absY > absX * 1.2) {
    if (dy < 0) emit('swipeUp');
    else emit('swipeDown');
    return;
  }

  // Swipe horizontal navigation.
  if (absX >= SWIPE_PX && absX > absY * 1.2) {
    if (dx < 0) emit('swipeLeft');
    else emit('swipeRight');
    return;
  }

  // Tap (quick, minimal movement)
  if (elapsed < 500 && absX < SWIPE_PX && absY < SWIPE_PX) {
    emit('tap', { pointerType: startPointerType, xPct, yPct });
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
  <!-- Only apply touch-none on desktop to prevent scroll interference. On mobile, allow normal scrolling -->
  <div
    class="absolute inset-0"
    :class="['md:touch-none']"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <!-- Slot is where overlay UI lives (controls, record button, etc). -->
    <slot />
  </div>
</template>

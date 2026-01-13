<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';

const props = defineProps<{
  durationSeconds: number;
  currentSeconds?: number;
  segments: MediaAssetSegment[];
  /** List of segment IDs that have narrations (used to style markers). */
  segmentsWithNarrations?: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'seek', seconds: number): void;
}>();

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Zoom behavior
// - zoom=1 means "full duration fits in the bar"
// - zoom>1 means we show a window into the full duration
const zoom = ref(1);
const MIN_ZOOM = 1;
const MAX_ZOOM = 40;

const trackEl = ref<HTMLElement | null>(null);

// When zoomed in, the visible window is [windowStartSeconds, windowStartSeconds + windowSeconds].
// This is stateful so zooming can be anchored to cursor position, not currentSeconds.
const windowStartSeconds = ref(0);

const windowSeconds = computed(() => {
  const d = props.durationSeconds ?? 0;
  if (!d) return 0;
  return d / zoom.value;
});

const windowStart = computed(() => {
  const d = props.durationSeconds ?? 0;
  const w = windowSeconds.value;
  if (!d || !w) return 0;

  if (zoom.value <= 1) return 0;
  return clamp(windowStartSeconds.value, 0, Math.max(0, d - w));
});

watch(
  () => [props.durationSeconds, zoom.value] as const,
  () => {
    const d = props.durationSeconds ?? 0;
    const w = windowSeconds.value;
    if (!d || !w || zoom.value <= 1) {
      windowStartSeconds.value = 0;
      return;
    }

    windowStartSeconds.value = clamp(windowStartSeconds.value, 0, Math.max(0, d - w));
  },
  { immediate: true }
);

// Keep the playhead visible while zoomed, without forcing it to be centered.
watch(
  () => props.currentSeconds ?? 0,
  (tRaw) => {
    if (zoom.value <= 1) return;
    const d = props.durationSeconds ?? 0;
    const w = windowSeconds.value;
    if (!d || !w) return;

    const t = clamp(tRaw, 0, d);
    const start = windowStart.value;
    const end = start + w;

    // If playback drifts outside the window, pan just enough to bring it back.
    const margin = w * 0.15;
    const minVisible = start + margin;
    const maxVisible = end - margin;

    if (t < minVisible) {
      windowStartSeconds.value = clamp(t - margin, 0, Math.max(0, d - w));
    } else if (t > maxVisible) {
      windowStartSeconds.value = clamp(t - (w - margin), 0, Math.max(0, d - w));
    }
  }
);

function pctForSeconds(seconds: number): number {
  const d = props.durationSeconds ?? 0;
  if (!d) return 0;

  const w = windowSeconds.value;
  if (!w || zoom.value <= 1) {
    return clamp(seconds / d, 0, 1) * 100;
  }

  const start = windowStart.value;
  const rel = (seconds - start) / w;
  return clamp(rel, 0, 1) * 100;
}

const orderedSegments = computed(() => {
  return [...(props.segments ?? [])].sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0));
});

function onTrackPointer(e: PointerEvent) {
  const el = (trackEl.value ?? (e.currentTarget as HTMLElement | null)) as HTMLElement | null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (!rect.width) return;
  const x = clamp(e.clientX - rect.left, 0, rect.width);
  const pct = x / rect.width;
  const d = props.durationSeconds ?? 0;
  const w = windowSeconds.value;
  const seconds = zoom.value <= 1 || !w ? pct * d : windowStart.value + pct * w;
  emit('seek', seconds);
}

let activePointerId: number | null = null;
function onPointerDown(e: PointerEvent) {
  // left click only for mouse
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  activePointerId = e.pointerId;
  (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
  onTrackPointer(e);
}

function onPointerMove(e: PointerEvent) {
  if (activePointerId === null) return;
  if (e.pointerId !== activePointerId) return;
  onTrackPointer(e);
}

function onPointerUp(e: PointerEvent) {
  if (activePointerId === null) return;
  if (e.pointerId !== activePointerId) return;
  (e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId);
  activePointerId = null;
}

// Pinch to zoom on touch devices.
let pinchStartDist = 0;
let pinchStartZoom = 1;
let pinchAnchorPct = 0.5;
let pinchAnchorSeconds = 0;

function touchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length !== 2) return;
  const el = trackEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (!rect.width) return;

  const [t1, t2] = [e.touches[0]!, e.touches[1]!];
  pinchStartDist = touchDistance(t1, t2);
  pinchStartZoom = zoom.value;

  const midX = (t1.clientX + t2.clientX) / 2;
  const x = clamp(midX - rect.left, 0, rect.width);
  pinchAnchorPct = rect.width ? x / rect.width : 0.5;

  const d = props.durationSeconds ?? 0;
  const oldW = d ? d / zoom.value : 0;
  const oldStart = zoom.value <= 1 ? 0 : windowStart.value;
  pinchAnchorSeconds = zoom.value <= 1 || !oldW ? pinchAnchorPct * d : oldStart + pinchAnchorPct * oldW;
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length !== 2) return;
  const el = trackEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (!rect.width) return;

  const [t1, t2] = [e.touches[0]!, e.touches[1]!];
  const dist = touchDistance(t1, t2);
  if (!pinchStartDist) return;

  const ratio = dist / pinchStartDist;
  const nextZoom = clamp(pinchStartZoom * ratio, MIN_ZOOM, MAX_ZOOM);

  const d = props.durationSeconds ?? 0;
  if (!d) return;

  zoom.value = nextZoom;
  if (zoom.value <= 1) {
    windowStartSeconds.value = 0;
    return;
  }

  const newW = d / zoom.value;
  const newStart = pinchAnchorSeconds - pinchAnchorPct * newW;
  windowStartSeconds.value = clamp(newStart, 0, Math.max(0, d - newW));
}

function onWheel(e: WheelEvent) {
  const el = trackEl.value ?? (e.currentTarget as HTMLElement | null);
  if (!el) return;

  const d = props.durationSeconds ?? 0;
  if (!d) return;

  const rect = el.getBoundingClientRect();
  if (!rect.width) return;

  // Zoom around the cursor position (anchor seconds under the mouse).
  const x = clamp(e.clientX - rect.left, 0, rect.width);
  const anchorPct = x / rect.width;

  const prevZoom = zoom.value;
  const prevW = d / prevZoom;
  const prevStart = prevZoom <= 1 ? 0 : windowStart.value;
  const anchorSeconds = prevZoom <= 1 ? anchorPct * d : prevStart + anchorPct * prevW;

  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  const nextZoom = clamp(prevZoom * factor, MIN_ZOOM, MAX_ZOOM);
  zoom.value = nextZoom;

  if (zoom.value <= 1) {
    windowStartSeconds.value = 0;
    return;
  }

  const nextW = d / zoom.value;
  const nextStart = anchorSeconds - anchorPct * nextW;
  windowStartSeconds.value = clamp(nextStart, 0, Math.max(0, d - nextW));
}
</script>

<template>
  <div class="w-full">
    <div class="mb-1 flex items-center justify-between text-[11px] text-white/50">
      <div>Timeline</div>
      <div v-if="durationSeconds" class="tabular-nums flex items-center gap-2">
        <span>{{ Math.round(durationSeconds) }}s</span>
        <span class="text-white/35">•</span>
        <span title="Scroll to zoom">Zoom {{ zoom.toFixed(1) }}×</span>
      </div>
    </div>

    <div
      class="relative h-8 w-full rounded-lg bg-white/5 ring-1 ring-white/10"
      style="touch-action: none"
      ref="trackEl"
      @pointerdown.stop.prevent="onPointerDown"
      @pointermove.stop.prevent="onPointerMove"
      @pointerup.stop.prevent="onPointerUp"
      @pointercancel.stop.prevent="onPointerUp"
      @touchstart.stop.prevent="onTouchStart"
      @touchmove.stop.prevent="onTouchMove"
      @touchend.stop.prevent
      @touchcancel.stop.prevent
      @wheel.stop.prevent="onWheel"
    >
      <!-- Active playhead -->
      <div
        v-if="durationSeconds"
        class="absolute top-0 bottom-0 w-0.5 bg-white/60"
        :style="{ left: `${pctForSeconds(currentSeconds ?? 0)}%` }"
        title="Current time"
      />

      <!-- Segment markers -->
      <div
        v-for="seg in orderedSegments"
        :key="seg.id"
        class="absolute top-1 bottom-1 w-0.5 rounded-full"
        :style="{ left: `${pctForSeconds(seg.start_seconds)}%` }"
        :class="(
          segmentsWithNarrations?.has(String(seg.id))
            ? 'bg-emerald-300/80'
            : (seg.source_type === 'coach' ? 'bg-sky-300/70' : 'bg-white/25')
        )"
        :title="`Segment ${seg.segment_index + 1} @ ${Math.round(seg.start_seconds)}s`"
      />

      <!-- Click target overlay -->
      <div class="absolute inset-0" />
    </div>
  </div>
</template>

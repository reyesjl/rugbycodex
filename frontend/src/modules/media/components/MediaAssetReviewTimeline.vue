<script setup lang="ts">
import { animateMini } from 'motion';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';

const props = defineProps<{
  durationSeconds: number;
  currentSeconds?: number;
  segments: MediaAssetSegment[];
  /** List of segment IDs that have narrations (used to style markers). */
  segmentsWithNarrations?: Set<string>;
  /** Segment IDs with in-flight narration creates (renders pulsing pending marker). */
  pendingSegmentIds?: string[];
  /** Narration counts keyed by segment id (used for density sizing/height). */
  narrationCountsBySegmentId?: Record<string, number>;
  /** Segment IDs to show in markers + prev/next navigation (keeps in sync with filters). */
  visibleSegmentIds?: string[];
  /** Segment id the player is currently inside (for highlight). */
  activeSegmentId?: string | null;
  /** Segment id the UI is focusing (e.g. user clicked a segment). */
  focusedSegmentId?: string | null;
  /** If true, only render markers for segments that have narrations. */
  onlyNarratedMarkers?: boolean;
}>();

const emit = defineEmits<{
  (e: 'seek', seconds: number): void;
  (e: 'jumpToSegment', segment: MediaAssetSegment): void;
}>();

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const MAX_NARRATION_DENSITY_LEVEL = 5;

const timelineEl = ref<HTMLElement | null>(null);
const activeDotTrackerEl = ref<HTMLElement | null>(null);

const isCoarsePointer = ref(false);
let pointerMedia: MediaQueryList | null = null;

function onPointerMediaChange() {
  syncPointerCapability();
}

function syncPointerCapability() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    isCoarsePointer.value = false;
    return;
  }
  pointerMedia = pointerMedia ?? window.matchMedia('(pointer: coarse)');
  isCoarsePointer.value = Boolean(pointerMedia.matches);
}

onMounted(() => {
  syncPointerCapability();
  if (!pointerMedia) return;
  (pointerMedia.addEventListener?.('change', onPointerMediaChange) ?? pointerMedia.addListener?.(onPointerMediaChange));
});

onBeforeUnmount(() => {
  if (!pointerMedia) return;
  (pointerMedia.removeEventListener?.('change', onPointerMediaChange) ?? pointerMedia.removeListener?.(onPointerMediaChange));
});

const duration = computed(() => Math.max(0, props.durationSeconds ?? 0));
const effectivePlayheadSeconds = computed(() => clamp(props.currentSeconds ?? 0, 0, duration.value || 0));
const quarterProgressPcts = computed(() => {
  const d = duration.value;
  if (!d) return [0, 0, 0, 0];
  const quarter = d / 4;
  const t = effectivePlayheadSeconds.value;
  return [0, 1, 2, 3].map((i) => {
    const start = i * quarter;
    return clamp(((t - start) / quarter) * 100, 0, 100);
  });
});
const playheadPct = computed(() => pctForSeconds(effectivePlayheadSeconds.value));
const currentTimestampLabel = computed(() => {
  if (!duration.value) return '';
  const total = Math.max(0, Math.floor(effectivePlayheadSeconds.value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
});

function pctForSeconds(seconds: number): number {
  const d = duration.value;
  if (!d) return 0;
  return clamp(seconds / d, 0, 1) * 100;
}

const orderedSegments = computed(() => {
  return [...(props.segments ?? [])].sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0));
});

const visibleSegmentIdSet = computed(() => {
  if (!props.visibleSegmentIds) return null;
  const set = new Set<string>();
  for (const id of props.visibleSegmentIds) {
    if (!id) continue;
    set.add(String(id));
  }
  return set;
});

const pendingSegmentIdSet = computed(() => {
  const set = new Set<string>();
  for (const id of props.pendingSegmentIds ?? []) {
    if (!id) continue;
    set.add(String(id));
  }
  return set;
});

function isNarratedSegment(seg: MediaAssetSegment): boolean {
  const set = props.segmentsWithNarrations;
  if (!set) return false;
  return set.has(String(seg.id));
}

const visibleMarkerSegments = computed(() => {
  const list = orderedSegments.value;
  const idSet = visibleSegmentIdSet.value;
  if (idSet) {
    return list.filter((s) => idSet.has(String(s.id)));
  }
  if (!props.onlyNarratedMarkers) return list;
  if (!props.segmentsWithNarrations) return list;
  return list.filter((s) => isNarratedSegment(s));
});

function segmentStart(seg: MediaAssetSegment): number {
  return clamp(Number(seg.start_seconds ?? 0), 0, duration.value || 0);
}

function segmentEnd(seg: MediaAssetSegment): number {
  const start = segmentStart(seg);
  const rawEnd = Number(seg.end_seconds ?? start);
  return clamp(Math.max(rawEnd, start + 0.1), 0, duration.value || 0);
}

function narrationCountForSegment(seg: MediaAssetSegment): number {
  const counts = props.narrationCountsBySegmentId;
  const value = Number(counts?.[String(seg.id)] ?? 0);
  const normalized = Math.max(1, Number.isFinite(value) ? value : 1);
  return Math.min(MAX_NARRATION_DENSITY_LEVEL, normalized);
}

const maxVisibleNarrationCount = computed(() => {
  let max = 1;
  for (const seg of visibleMarkerSegments.value) {
    max = Math.max(max, narrationCountForSegment(seg));
  }
  return max;
});

const timelineDots = computed(() => {
  const d = duration.value;
  if (!d) return [] as Array<{ seg: MediaAssetSegment; leftPct: number; topPct: number; sizePx: number }>;
  const maxCount = maxVisibleNarrationCount.value;
  return visibleMarkerSegments.value.map((seg) => {
    const start = segmentStart(seg);
    const count = narrationCountForSegment(seg);
    const density = maxCount > 1 ? (count - 1) / (maxCount - 1) : 0;
    return {
      seg,
      leftPct: pctForSeconds(start),
      topPct: 82 - (density * 60),
      sizePx: 6 + (density * 12),
    };
  });
});

const activeTrackerDot = computed(() => {
  const activeId = effectiveActiveDotId.value;
  if (!activeId) return null;
  const dot = timelineDots.value.find((entry) => String(entry.seg.id) === activeId);
  if (!dot) return null;
  return { leftPct: dot.leftPct, topPct: dot.topPct };
});

const timelineDensityGradient = computed(() => {
  const d = duration.value;
  const segments = visibleMarkerSegments.value;
  if (!d || !segments.length) return '';

  const sampleCount = 72;
  const sigma = 0.035;
  const samples = Array.from({ length: sampleCount }, (_, idx) => {
    const x = idx / (sampleCount - 1);
    return { x, value: 0 };
  });

  for (const seg of segments) {
    const center = clamp(segmentStart(seg) / d, 0, 1);
    const weight = narrationCountForSegment(seg);
    for (const sample of samples) {
      const dist = sample.x - center;
      sample.value += Math.exp(-(dist * dist) / (2 * sigma * sigma)) * weight;
    }
  }

  const maxSample = Math.max(...samples.map((sample) => sample.value), 0);
  if (!maxSample) return '';

  const stops = samples.map((sample) => {
    const edgeFade = Math.pow(Math.sin(Math.PI * sample.x), 0.9);
    const intensity = (sample.value / maxSample) * edgeFade;
    const boostedIntensity = Math.pow(intensity, 1.45);
    const alpha = boostedIntensity * 0.9;
    const pct = sample.x * 100;
    return `rgba(134,239,172,${alpha.toFixed(3)}) ${pct.toFixed(2)}%`;
  });
  return `linear-gradient(90deg, rgba(134,239,172,0) 0%, ${stops.join(', ')}, rgba(134,239,172,0) 100%)`;
});

function isFocused(seg: MediaAssetSegment): boolean {
  const id = props.focusedSegmentId ? String(props.focusedSegmentId) : '';
  return Boolean(id && String(seg.id) === id);
}

function isPending(seg: MediaAssetSegment): boolean {
  return pendingSegmentIdSet.value.has(String(seg.id));
}

const effectiveActiveDotId = computed(() => {
  const visible = visibleMarkerSegments.value;
  if (!visible.length) return '';

  const activeId = props.activeSegmentId ? String(props.activeSegmentId) : '';
  if (activeId && visible.some((seg) => String(seg.id) === activeId)) return activeId;

  const focusedId = props.focusedSegmentId ? String(props.focusedSegmentId) : '';
  if (focusedId && visible.some((seg) => String(seg.id) === focusedId)) return focusedId;

  const t = effectivePlayheadSeconds.value;
  let bestId = String(visible[0]?.id ?? '');
  let bestDist = Number.POSITIVE_INFINITY;
  for (const seg of visible) {
    const dist = Math.abs(segmentStart(seg) - t);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = String(seg.id);
    }
  }
  return bestId;
});

function isActive(seg: MediaAssetSegment): boolean {
  return String(seg.id) === effectiveActiveDotId.value;
}

watch(activeTrackerDot, (nextDot, prevDot) => {
  if (!nextDot) return;
  void nextTick(() => {
    const el = activeDotTrackerEl.value;
    if (!el) return;
    if (!prevDot) {
      animateMini(el, { scale: [0.92, 1.04, 1] }, { duration: 0.16, ease: 'easeOut' });
      return;
    }
    animateMini(
      el,
      {
        left: [`${prevDot.leftPct}%`, `${nextDot.leftPct}%`],
        top: [`${prevDot.topPct}%`, `${nextDot.topPct}%`],
      },
      { duration: 0.14, ease: 'easeOut' }
    );
  });
}, { deep: true });

function onTrackClick(e: MouseEvent) {
  const el = timelineEl.value;
  if (!el) return;
  const d = duration.value;
  if (!d) return;

  const rect = el.getBoundingClientRect();
  if (!rect.width) return;
  const x = clamp(e.clientX - rect.left, 0, rect.width);
  const seconds = clamp((x / rect.width) * d, 0, d);
  emit('seek', seconds);
}

// Hover magnifier (desktop only)
const hoverX = ref<number | null>(null);
const hoverY = ref<number | null>(null);
const hoverSeconds = ref<number | null>(null);
const timelineWidthPx = ref<number>(0);
const timelineHeightPx = ref<number>(0);

const MAG_WIDTH_PX = 180;
const MAG_HEIGHT_PX = 12;
const MAG_WINDOW_PCT = 0.08;
const MAG_WINDOW_MIN_SECONDS = 6;
const MAG_WINDOW_MAX_SECONDS = 180;

function onMouseMove(e: MouseEvent) {
  if (isCoarsePointer.value) return;
  const el = timelineEl.value;
  if (!el) return;
  const d = duration.value;
  if (!d) return;

  const rect = el.getBoundingClientRect();
  if (!rect.width) return;
  const x = clamp(e.clientX - rect.left, 0, rect.width);

  timelineWidthPx.value = rect.width;
  timelineHeightPx.value = rect.height;
  hoverX.value = x;
  hoverY.value = clamp(e.clientY - rect.top, 0, rect.height);
  hoverSeconds.value = clamp((x / rect.width) * d, 0, d);
}

function onMouseLeave() {
  hoverX.value = null;
  hoverY.value = null;
  hoverSeconds.value = null;
}

const hoverPct = computed(() => {
  const w = timelineWidthPx.value;
  const x = hoverX.value;
  if (!w || x === null) return null;
  return clamp((x / w) * 100, 0, 100);
});

const magnifierWindowSeconds = computed(() => {
  const d = duration.value;
  if (!d) return 0;
  return clamp(d * MAG_WINDOW_PCT, MAG_WINDOW_MIN_SECONDS, MAG_WINDOW_MAX_SECONDS);
});

const magnifierStartSeconds = computed(() => {
  const d = duration.value;
  const h = hoverSeconds.value;
  const w = magnifierWindowSeconds.value;
  if (!d || h === null || !w) return 0;
  const maxStart = Math.max(0, d - w);
  return clamp(h - w / 2, 0, maxStart);
});

const magnifierEndSeconds = computed(() => {
  return magnifierStartSeconds.value + magnifierWindowSeconds.value;
});

const showMagnifier = computed(() => {
  if (isCoarsePointer.value) return false;
  if (hoverX.value === null || hoverSeconds.value === null) return false;
  if (!duration.value) return false;
  return true;
});

const magnifierLeftPx = computed(() => {
  const w = timelineWidthPx.value;
  const x = hoverX.value;
  if (!w || x === null) return 0;
  return clamp(x - MAG_WIDTH_PX / 2, 0, Math.max(0, w - MAG_WIDTH_PX));
});

const magnifierTopPx = computed(() => {
  return -(MAG_HEIGHT_PX + 2);
});

const magnifierCursorPct = computed(() => {
  return 50;
});

const magnifierSegments = computed(() => {
  const start = magnifierStartSeconds.value;
  const end = magnifierEndSeconds.value;
  return visibleMarkerSegments.value.filter((s) => {
    const t = Number(s.start_seconds ?? 0);
    return t >= start && t <= end;
  });
});

const magnifierDots = computed(() => {
  return magnifierSegments.value.map((seg) => {
    const start = segmentStart(seg);
    const end = segmentEnd(seg);
    const durationSeconds = Math.max(0.1, end - start);
    return {
      seg,
      leftPct: magLeftPctForSeconds(start),
      sizePx: 4 + Math.min(2, Math.sqrt(durationSeconds) * 0.6),
    };
  });
});

function magLeftPctForSeconds(seconds: number): number {
  const start = magnifierStartSeconds.value;
  const win = magnifierWindowSeconds.value;
  if (!win) return 0;
  return clamp(((seconds - start) / win) * 100, 0, 100);
}

function currentNavIndex(): number {
  const list = visibleMarkerSegments.value;
  if (!list.length) return -1;

  const focusedId = props.focusedSegmentId ? String(props.focusedSegmentId) : '';
  if (focusedId) {
    const idx = list.findIndex((s) => String(s.id) === focusedId);
    if (idx >= 0) return idx;
  }

  const activeId = props.activeSegmentId ? String(props.activeSegmentId) : '';
  if (activeId) {
    const idx = list.findIndex((s) => String(s.id) === activeId);
    if (idx >= 0) return idx;
  }

  const t = effectivePlayheadSeconds.value;
  let idx = -1;
  for (let i = 0; i < list.length; i++) {
    const seg = list[i];
    if (!seg) break;
    if ((seg.start_seconds ?? 0) <= t) idx = i;
    else break;
  }
  return idx;
}

const canJumpPrev = computed(() => {
  const idx = currentNavIndex();
  return idx > 0;
});

const canJumpNext = computed(() => {
  const idx = currentNavIndex();
  const list = visibleMarkerSegments.value;
  if (!list.length) return false;
  return idx < list.length - 1;
});

function jumpPrev() {
  const list = visibleMarkerSegments.value;
  if (!list.length) return;
  const idx = currentNavIndex();
  const nextIdx = clamp(idx - 1, 0, list.length - 1);
  const seg = list[nextIdx];
  if (seg) emit('jumpToSegment', seg);
}

function jumpNext() {
  const list = visibleMarkerSegments.value;
  if (!list.length) return;
  const idx = currentNavIndex();
  const nextIdx = clamp(idx + 1, 0, list.length - 1);
  const seg = list[nextIdx];
  if (seg) emit('jumpToSegment', seg);
}
</script>

<template>
  <div class="w-full">
    <div class="flex items-center gap-0">
      <div class="h-7 w-9 shrink-0" />
      <div class="relative grid flex-1 grid-cols-4 gap-1">
        <div
          v-if="currentTimestampLabel"
          class="pointer-events-none absolute left-0 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold leading-none text-black transition-[left] duration-100 ease-linear will-change-[left] motion-reduce:transition-none"
          :style="{ left: `${playheadPct}%` }"
        >
          {{ currentTimestampLabel }}
        </div>
        <div
          v-for="(pct, idx) in quarterProgressPcts"
          :key="`quarter-${idx}`"
          class="relative h-0.5 rounded-full bg-slate-400/45"
        >
          <div class="h-0.5 rounded-full bg-white" :style="{ width: `${pct}%` }" />
        </div>
      </div>
      <div class="h-7 w-9 shrink-0" />
    </div>

    <div class="flex items-stretch gap-0">
      <button
        type="button"
        class="flex h-20 w-9 shrink-0 items-center justify-center rounded-l-lg border border-r-0 border-slate-700/50 bg-slate-700/35 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 disabled:opacity-40 transition"
        :disabled="!canJumpPrev"
        @click="jumpPrev"
        aria-label="Previous segment"
        title="Previous segment"
      >
        <Icon icon="carbon:previous-outline" class="h-5 w-5" />
      </button>

      <div class="relative min-w-0 flex-1" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
        <div
          v-if="durationSeconds"
          class="pointer-events-none absolute -top-6 bottom-0 z-40 border-l border-dotted border-white/80 transition-[left] duration-75 ease-linear will-change-[left] motion-reduce:transition-none"
          :style="{ left: `${playheadPct}%` }"
        />
        <div
          ref="timelineEl"
          class="relative h-20 w-full overflow-visible border border-slate-700/50 bg-slate-700/20 cursor-pointer"
          :style="{ backgroundImage: timelineDensityGradient || undefined }"
          @click="onTrackClick"
        >
          <!-- Midline anchor -->
          <div class="pointer-events-none absolute left-0 right-0 top-1/2 z-0 h-px -translate-y-1/2 bg-white/20" />

          <!-- Hover cursor line (desktop only) -->
          <div
            v-if="showMagnifier && hoverPct !== null"
            class="absolute top-0 bottom-0 w-px bg-blue-400/60 z-30"
            :style="{ left: `${hoverPct}%` }"
          />

          <!-- Event dots -->
          <div
            v-for="dot in timelineDots"
            :key="dot.seg.id"
            class="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
              :style="{
              left: `${dot.leftPct}%`,
              top: `${dot.topPct}%`,
              width: isPending(dot.seg) ? '16px' : `${dot.sizePx}px`,
              height: isPending(dot.seg) ? '16px' : `${dot.sizePx}px`,
            }"
            :data-dot-id="String(dot.seg.id)"
            :class="[
              isPending(dot.seg) ? 'bg-yellow-400 animate-pulse' : (isNarratedSegment(dot.seg) ? 'bg-slate-100' : 'bg-slate-400'),
              isFocused(dot.seg) && !isActive(dot.seg) ? 'ring-2 ring-blue-300' : '',
              isPending(dot.seg)
                ? 'border border-yellow-100/90 opacity-95'
                : 'opacity-65'
            ]"
            @click.stop="emit('jumpToSegment', dot.seg)"
            :title="`Segment ${dot.seg.segment_index + 1} @ ${Math.round(dot.seg.start_seconds)}s`"
          />
          <div
            v-if="activeTrackerDot"
            ref="activeDotTrackerEl"
            class="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-red-500 opacity-85"
            :style="{ left: `${activeTrackerDot.leftPct}%`, top: `${activeTrackerDot.topPct}%`, width: '22px', height: '22px' }"
          >
            <div class="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          </div>
        </div>

        <!-- Hover magnifier overlay (desktop only) -->
        <div
          v-if="showMagnifier"
          class="pointer-events-none absolute z-40"
          :style="{ left: `${magnifierLeftPx}px`, top: `${magnifierTopPx}px`, width: `${MAG_WIDTH_PX}px`, height: `${MAG_HEIGHT_PX}px` }"
        >
          <div class="relative h-full w-full rounded-lg border border-white/35 bg-black">
              <!-- magnifier playhead -->
              <div
                v-if="durationSeconds"
                class="absolute top-0 bottom-0 w-1 bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)] z-20"
                :style="{ left: `${magLeftPctForSeconds(effectivePlayheadSeconds)}%` }"
              />

              <!-- magnifier cursor line -->
              <div
                class="absolute top-0 bottom-0 w-px bg-white z-30"
                :style="{ left: `${magnifierCursorPct}%` }"
              />

              <!-- magnifier dots (precision mode) -->
              <div
                v-for="dot in magnifierDots"
                :key="`mag-${dot.seg.id}`"
                class="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
                :style="{ left: `${dot.leftPct}%`, width: `${dot.sizePx}px`, height: `${dot.sizePx}px` }"
                :class="[
                  'bg-white',
                  isFocused(dot.seg) ? 'ring-1 ring-blue-300' : '',
                  isActive(dot.seg) ? 'bg-white opacity-100 shadow-[0_0_6px_rgba(255,255,255,0.55)]' : 'opacity-90'
                ]"
              />
          </div>
        </div>
      </div>

      <button
        type="button"
        class="flex h-20 w-9 shrink-0 items-center justify-center rounded-r-lg border border-l-0 border-slate-700/50 bg-slate-700/35 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 disabled:opacity-40 transition"
        :disabled="!canJumpNext"
        @click="jumpNext"
        aria-label="Next segment"
        title="Next segment"
      >
        <Icon icon="carbon:next-outline" class="h-5 w-5" />
      </button>
    </div>
  </div>
</template>

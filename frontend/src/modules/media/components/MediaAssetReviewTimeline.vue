<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';

const props = defineProps<{
  durationSeconds: number;
  currentSeconds?: number;
  segments: MediaAssetSegment[];
  /** List of segment IDs that have narrations (used to style markers). */
  segmentsWithNarrations?: Set<string>;
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

const timelineEl = ref<HTMLElement | null>(null);

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

function isFocused(seg: MediaAssetSegment): boolean {
  const id = props.focusedSegmentId ? String(props.focusedSegmentId) : '';
  return Boolean(id && String(seg.id) === id);
}

function isActive(seg: MediaAssetSegment): boolean {
  const id = props.activeSegmentId ? String(props.activeSegmentId) : '';
  return Boolean(id && String(seg.id) === id);
}

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
const hoverSeconds = ref<number | null>(null);
const timelineWidthPx = ref<number>(0);

const MAG_WIDTH_PX = 240;
const MAG_HEIGHT_PX = 20;
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
  hoverX.value = x;
  hoverSeconds.value = clamp((x / rect.width) * d, 0, d);
}

function onMouseLeave() {
  hoverX.value = null;
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

const magnifierCursorPct = computed(() => {
  const h = hoverSeconds.value;
  const start = magnifierStartSeconds.value;
  const win = magnifierWindowSeconds.value;
  if (h === null || !win) return 50;
  return clamp(((h - start) / win) * 100, 0, 100);
});

const magnifierSegments = computed(() => {
  const start = magnifierStartSeconds.value;
  const end = magnifierEndSeconds.value;
  return visibleMarkerSegments.value.filter((s) => {
    const t = Number(s.start_seconds ?? 0);
    return t >= start && t <= end;
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
    <div class="mb-2 flex items-center justify-between text-xs text-slate-400">
      <div>Timeline</div>
      <div v-if="durationSeconds" class="tabular-nums flex items-center gap-2">
        <span>{{ (Math.round(durationSeconds) / 60).toFixed() }} min</span>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-40 transition"
        :disabled="!canJumpPrev"
        @click="jumpPrev"
        aria-label="Previous segment"
        title="Previous segment"
      >
        <Icon icon="carbon:previous-outline" class="h-5 w-5" />
      </button>

      <div class="relative flex-1">
        <div
          ref="timelineEl"
          class="relative h-8 w-full overflow-hidden rounded-lg bg-slate-700/30 border border-slate-700/50 cursor-pointer"
          @click="onTrackClick"
          @mousemove="onMouseMove"
          @mouseleave="onMouseLeave"
        >
          <!-- Active playhead -->
          <div
            v-if="durationSeconds"
            class="absolute top-0 bottom-0 w-1 bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)] z-20"
            :style="{ left: `${pctForSeconds(effectivePlayheadSeconds)}%` }"
            title="Current time"
          />

          <!-- Hover cursor line (desktop only) -->
          <div
            v-if="showMagnifier && hoverPct !== null"
            class="absolute top-0 bottom-0 w-px bg-blue-400/60 z-30"
            :style="{ left: `${hoverPct}%` }"
          />

          <!-- Segment markers -->
          <div
            v-for="seg in visibleMarkerSegments"
            :key="seg.id"
            class="absolute top-0 bottom-0 w-1 rounded-full z-10"
            :style="{ left: `${pctForSeconds(seg.start_seconds)}%` }"
            :class="[
              isNarratedSegment(seg) ? 'bg-slate-300' : 'bg-slate-500',
              isFocused(seg) ? 'outline-1 outline-blue-400' : '',
              isActive(seg) ? 'opacity-100' : 'opacity-70'
            ]"
            @click.stop="emit('jumpToSegment', seg)"
            :title="`Segment ${seg.segment_index + 1} @ ${Math.round(seg.start_seconds)}s`"
          />
        </div>

        <!-- Hover magnifier overlay (desktop only) -->
        <div
          v-if="showMagnifier"
          class="absolute z-40 -top-12"
          :style="{ left: `${magnifierLeftPx}px`, width: `${MAG_WIDTH_PX}px`, height: `${MAG_HEIGHT_PX}px` }"
          @click.stop
        >
          <div class="relative h-full w-full rounded-lg bg-slate-900/90 border border-slate-700/50 backdrop-blur-sm">
            <div class="absolute inset-1 rounded-md bg-slate-800/50 border border-slate-700/50">
              <!-- magnifier playhead -->
              <div
                v-if="durationSeconds"
                class="absolute top-0 bottom-0 w-1 bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)] z-20"
                :style="{ left: `${magLeftPctForSeconds(effectivePlayheadSeconds)}%` }"
              />

              <!-- magnifier cursor line -->
              <div
                class="absolute top-0 bottom-0 w-px bg-blue-400/80 z-30"
                :style="{ left: `${magnifierCursorPct}%` }"
              />

              <!-- magnifier segment markers (thicker) -->
              <div
                v-for="seg in magnifierSegments"
                :key="`mag-${seg.id}`"
                class="absolute top-0 bottom-0 w-2 rounded-full z-10"
                :style="{ left: `${magLeftPctForSeconds(seg.start_seconds)}%` }"
                :class="[
                  isNarratedSegment(seg) ? 'bg-slate-300' : 'bg-slate-500',
                  isFocused(seg) ? 'outline-1 outline-blue-400' : '',
                  isActive(seg) ? 'opacity-100' : 'opacity-80'
                ]"
                @click.stop="emit('jumpToSegment', seg)"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-40 transition"
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

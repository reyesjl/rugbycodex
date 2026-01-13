<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { Narration } from '@/modules/narrations/types/Narration';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';
import { formatMinutesSeconds } from '@/lib/duration';
import type { NarrationListItem } from '@/modules/narration/composables/useNarrationRecorder';

const props = defineProps<{
  segments: MediaAssetSegment[];
  narrations: NarrationListItem[];
  activeSegmentId?: string | null;
  /** Segment to scroll into view when user seeks/selects. */
  focusedSegmentId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'jumpToSegment', segment: MediaAssetSegment): void;
  (e: 'editNarration', narrationId: string, transcriptRaw: string): void;
  (e: 'deleteNarration', narrationId: string): void;
}>();

const editingNarrationId = ref<string | null>(null);
const editingText = ref('');

function isSavedNarration(n: NarrationListItem): n is Narration {
  // Optimistic narrations have a `status` field; saved narrations don't.
  return !(n as any)?.status;
}

function canEditOrDelete(n: NarrationListItem): boolean {
  // On this screen, controls should always be visible.
  // Disable actions only for optimistic (uploading/error) placeholders.
  return isSavedNarration(n);
}

function startEditing(n: Narration) {
  editingNarrationId.value = String(n.id);
  editingText.value = n.transcript_raw ?? '';
}

function cancelEditing() {
  editingNarrationId.value = null;
  editingText.value = '';
}

function saveEditing(n: Narration) {
  const id = String(n.id);
  const nextText = editingText.value.trim();
  if (!nextText) return;
  emit('editNarration', id, nextText);
  cancelEditing();
}

function requestDelete(n: Narration) {
  const ok = window.confirm('Delete this narration?');
  if (!ok) return;
  emit('deleteNarration', String(n.id));
  if (editingNarrationId.value === String(n.id)) {
    cancelEditing();
  }
}

// Default: show only segments that have narrations.
const showEmptySegments = ref(false);

// Default: show only coach segments (coach narrations attach to coach-created segments).
const showAllSources = ref(false);

const segmentElById = ref(new Map<string, HTMLElement>());

function setSegmentEl(id: string, el: unknown) {
  if (!id) return;
  const map = segmentElById.value;
  if (!el) {
    map.delete(id);
    return;
  }

  // Vue template refs can be either DOM elements or component instances.
  const maybeEl = (el as any)?.$el ?? el;
  if (maybeEl instanceof HTMLElement) {
    map.set(id, maybeEl);
  }
}

async function scrollActiveIntoView() {
  const id = (props.focusedSegmentId ?? props.activeSegmentId) ? String(props.focusedSegmentId ?? props.activeSegmentId) : '';
  if (!id) return;
  await nextTick();
  const el = segmentElById.value.get(id);
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

watch(
  () => [props.focusedSegmentId, props.activeSegmentId],
  () => {
    void scrollActiveIntoView();
  }
);

const narrationsBySegment = computed(() => {
  const map = new Map<string, NarrationListItem[]>();
  for (const n of props.narrations ?? []) {
    const sid = String(n.media_asset_segment_id);
    const list = map.get(sid) ?? [];
    list.push(n);
    map.set(sid, list);
  }
  return map;
});

const sourceFilteredSegments = computed(() => {
  const base = props.segments ?? [];
  if (showAllSources.value) return base;
  return base.filter((s) => String(s.source_type ?? '') === 'coach');
});

const orderedSegments = computed(() => {
  const base = [...sourceFilteredSegments.value].sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0));
  if (showEmptySegments.value) return base;
  return base.filter((s) => (narrationsBySegment.value.get(String(s.id)) ?? []).length > 0);
});

const visibleSegmentCount = computed(() => orderedSegments.value.length);
const totalSegmentCount = computed(() => sourceFilteredSegments.value.length);

const visibleNarrationCount = computed(() => {
  let count = 0;
  for (const seg of orderedSegments.value) {
    count += (narrationsBySegment.value.get(String(seg.id)) ?? []).length;
  }
  return count;
});

function labelForSegment(seg: MediaAssetSegment): string {
  const start = formatMinutesSeconds(seg.start_seconds ?? 0);
  const end = formatMinutesSeconds(seg.end_seconds ?? 0);
  const kind = seg.source_type ? String(seg.source_type).toUpperCase() : 'SEG';
  return `${kind} • ${start}–${end}`;
}

function formatCreatedAt(value: any): string {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}
</script>

<template>
  <div class="space-y-3">
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <div class="text-sm font-semibold text-white">Narrations</div>
        <div class="text-xs text-white/50">
          {{ visibleSegmentCount }}/{{ totalSegmentCount }} segments • {{ visibleNarrationCount }}
        </div>
      </div>

      <!-- Filters: on mobile they sit on the next line and scroll horizontally -->
      <div class="-mx-1 flex items-center gap-3 overflow-x-auto whitespace-nowrap px-1">
        <button
          type="button"
          class="text-[11px] transition cursor-pointer rounded-full px-2 py-1 ring-1 ring-transparent hover:bg-white/5 hover:ring-white/10"
          :class="showAllSources ? 'text-white/80' : 'text-white/60'"
          @click="showAllSources = !showAllSources"
          :title="showAllSources ? 'Show only coach segments' : 'Show all segment sources'"
        >
          {{ showAllSources ? 'All sources' : 'Coach only' }}
        </button>
        <button
          type="button"
          class="text-[11px] transition cursor-pointer rounded-full px-2 py-1 ring-1 ring-transparent hover:bg-white/5 hover:ring-white/10"
          :class="showEmptySegments ? 'text-white/80' : 'text-white/60'"
          @click="showEmptySegments = !showEmptySegments"
          :title="showEmptySegments ? 'Hide empty segments' : 'Show empty segments'"
        >
          {{ showEmptySegments ? 'Hide empty segments' : 'Show empty segments' }}
        </button>
      </div>
    </div>

    <div v-if="(props.segments ?? []).length === 0" class="text-sm text-white/50">
      No segments yet.
    </div>

    <div v-else-if="orderedSegments.length === 0" class="text-sm text-white/50">
      No narrations yet.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="seg in orderedSegments"
        :key="seg.id"
        class="rounded-lg border border-white/10 bg-white/5"
        :ref="(el) => setSegmentEl(String(seg.id), el)"
        :class="activeSegmentId && String(seg.id) === activeSegmentId ? 'ring-1 ring-yellow-300/30 bg-yellow-300/5' : ''"
      >
        <button
          type="button"
          class="w-full px-3 py-2 flex items-center justify-between text-left cursor-pointer hover:bg-white/5 transition"
          @click="emit('jumpToSegment', seg)"
        >
          <div class="flex items-center gap-2 min-w-0">
            <div
              v-if="activeSegmentId && String(seg.id) === activeSegmentId"
              class="shrink-0 rounded-full bg-yellow-300/15 px-2 py-0.5 text-[10px] font-semibold text-yellow-100"
              title="Current playback is inside this segment"
            >
              Now
            </div>
            <div class="text-xs font-semibold text-white/80 truncate">
              {{ labelForSegment(seg) }}
            </div>
          </div>
          <div class="text-[11px] text-white/50">
            {{ (narrationsBySegment.get(String(seg.id)) ?? []).length }}
          </div>
        </button>

        <div v-if="(narrationsBySegment.get(String(seg.id)) ?? []).length" class="border-t border-white/10">
          <div class="px-3 py-2 space-y-2">
            <div
              v-for="n in (narrationsBySegment.get(String(seg.id)) ?? [])"
              :key="String((n as any).id)"
              class="rounded-md bg-black/25 ring-1 ring-white/5 p-2 transition cursor-pointer hover:bg-black/30 hover:ring-white/10"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="text-[11px] text-white/40">
                  {{ formatCreatedAt((n as any).created_at) }}
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="text-[11px] transition"
                    :class="canEditOrDelete(n) ? 'text-white/50 hover:text-white/80' : 'text-white/20 cursor-not-allowed'"
                    :disabled="!canEditOrDelete(n)"
                    @click.stop="canEditOrDelete(n) && startEditing(n as any)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="text-[11px] transition"
                    :class="canEditOrDelete(n) ? 'text-rose-200/70 hover:text-rose-200' : 'text-rose-200/20 cursor-not-allowed'"
                    :disabled="!canEditOrDelete(n)"
                    @click.stop="canEditOrDelete(n) && requestDelete(n as any)"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div v-if="isSavedNarration(n) && editingNarrationId === String(n.id)" class="mt-2 space-y-2">
                <textarea
                  v-model="editingText"
                  rows="3"
                  class="w-full rounded-md bg-black/30 ring-1 ring-white/10 px-2 py-1 text-sm text-white placeholder:text-white/30"
                />
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="text-[11px] text-white/50 hover:text-white/80 transition"
                    @click.stop="cancelEditing"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="text-[11px] rounded-md bg-white/10 px-2 py-1 text-white/80 hover:bg-white/15 transition"
                    :disabled="!editingText.trim()"
                    @click.stop="saveEditing(n)"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div v-else class="mt-1 text-sm text-white whitespace-pre-wrap">
                {{ (n as any).transcript_raw }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

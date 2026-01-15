<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import type { Narration } from '@/modules/narrations/types/Narration';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';
import type { SegmentTag, SegmentTagType } from '@/modules/media/types/SegmentTag';
import { formatMinutesSeconds } from '@/lib/duration';
import type { NarrationListItem } from '@/modules/narration/composables/useNarrationRecorder';

const props = defineProps<{
  segments: MediaAssetSegment[];
  narrations: NarrationListItem[];
  activeSegmentId?: string | null;
  /** Segment to scroll into view when user seeks/selects. */
  focusedSegmentId?: string | null;
  /** Initial selection for the source filter. */
  defaultSource?: 'all' | 'coach' | 'staff' | 'member' | 'ai';
  /** Staff+ can edit/delete any narration; members only their own. */
  canModerateNarrations?: boolean;
  /** Supabase auth user id (Narration.author_id). */
  currentUserId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'jumpToSegment', segment: MediaAssetSegment): void;
  (e: 'addNarration', segment: MediaAssetSegment): void;
  (e: 'assignSegment', segment: MediaAssetSegment): void;
  (e: 'editNarration', narrationId: string, transcriptRaw: string): void;
  (e: 'deleteNarration', narrationId: string): void;
  (e: 'addTag', payload: { segmentId: string; tagKey: string; tagType: SegmentTagType }): void;
  (e: 'removeTag', payload: { segmentId: string; tagId: string }): void;
}>();

const editingNarrationId = ref<string | null>(null);
const editingText = ref('');

const ACTION_TAGS = ['tackle', 'carry', 'pass', 'kick', 'ruck_entry', 'cleanout'] as const;
const CONTEXT_TAGS = ['set_piece', 'lineout', 'scrum', 'counter_attack', 'transition', 'exit', 'wide_channel'] as const;

const tagPanelOpenIds = ref(new Set<string>());

// Per-segment expand/collapse for narration lists.
// Only used when a segment has 2+ narrations.
const expandedSegmentIds = ref(new Set<string>());

function isSegmentExpanded(segmentId: string): boolean {
  return expandedSegmentIds.value.has(segmentId);
}

function toggleSegmentExpanded(segmentId: string) {
  const set = expandedSegmentIds.value;
  if (set.has(segmentId)) set.delete(segmentId);
  else set.add(segmentId);
  // Trigger reactivity for Set mutation
  expandedSegmentIds.value = new Set(set);
}

function isTagPanelOpen(segmentId: string): boolean {
  return tagPanelOpenIds.value.has(segmentId);
}

function toggleTagPanel(segmentId: string) {
  const set = tagPanelOpenIds.value;
  if (set.has(segmentId)) set.delete(segmentId);
  else set.add(segmentId);
  tagPanelOpenIds.value = new Set(set);
}

const canAddQuickTags = computed(() => Boolean(props.canModerateNarrations));

type SourceFilter = 'all' | 'coach' | 'staff' | 'member' | 'ai';

const SOURCE_FILTERS: Array<{ value: SourceFilter; label: string }> = [
  { value: 'all', label: 'All sources' },
  { value: 'coach', label: 'Coach' },
  { value: 'staff', label: 'Staff' },
  { value: 'member', label: 'Member' },
  { value: 'ai', label: 'AI' },
];

function formatTagLabel(tagKey: string): string {
  return String(tagKey ?? '').replace(/_/g, ' ');
}

function classForTag(tag: SegmentTag): string {
  const type = String(tag.tag_type ?? '');
  if (type === 'action') return 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-200/20';
  if (type === 'context') return 'bg-sky-500/15 text-sky-100 ring-1 ring-sky-200/20';
  if (type === 'identity') return 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-200/20';
  return 'bg-white/10 text-white/80 ring-1 ring-white/15';
}

function segmentHasTag(seg: MediaAssetSegment, tagKey: string, tagType: SegmentTagType): boolean {
  const tags = (seg.tags ?? []) as SegmentTag[];
  return tags.some((tag) => tag.tag_key === tagKey && tag.tag_type === tagType);
}

function canRemoveTag(tag: SegmentTag): boolean {
  if (props.canModerateNarrations) return true;
  if (tag.tag_type !== 'identity') return false;
  const userId = props.currentUserId ?? null;
  if (!userId) return false;
  return String(tag.created_by) === String(userId);
}

function addQuickTag(seg: MediaAssetSegment, tagKey: string, tagType: SegmentTagType) {
  if (!canAddQuickTags.value) return;
  if (segmentHasTag(seg, tagKey, tagType)) return;
  emit('addTag', { segmentId: String(seg.id), tagKey, tagType });
}

function removeTag(seg: MediaAssetSegment, tag: SegmentTag) {
  if (!canRemoveTag(tag)) return;
  emit('removeTag', { segmentId: String(seg.id), tagId: String(tag.id) });
}

function isSavedNarration(n: NarrationListItem): n is Narration {
  // Optimistic narrations have a `status` field; saved narrations don't.
  return !(n as any)?.status;
}

function canEditOrDelete(n: NarrationListItem): boolean {
  // On this screen, controls should always be visible.
  // Disable actions only for optimistic (uploading/error) placeholders.
  if (!isSavedNarration(n)) return false;

  if (props.canModerateNarrations) return true;

  const authorId = (n as Narration).author_id;
  const userId = props.currentUserId ?? null;
  return Boolean(authorId && userId && authorId === userId);
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

const selectedSource = ref<SourceFilter>('all');
const hasSelectedSource = ref(false);

function normalizeSource(value: unknown): SourceFilter {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'coach' || raw === 'staff' || raw === 'member' || raw === 'ai') {
    return raw as SourceFilter;
  }
  return 'all';
}

function setSelectedSource(next: SourceFilter) {
  selectedSource.value = next;
  hasSelectedSource.value = true;
}

watch(
  () => props.defaultSource,
  (next) => {
    if (hasSelectedSource.value) return;
    selectedSource.value = normalizeSource(next);
  },
  { immediate: true }
);

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

function visibleNarrationsForSegment(segId: string): NarrationListItem[] {
  const list = narrationsBySegment.value.get(String(segId)) ?? [];
  if (list.length <= 1) return list;
  if (isSegmentExpanded(String(segId))) return list;
  return list.slice(0, 1);
}

const sourceFilteredSegments = computed(() => {
  const base = props.segments ?? [];
  if (selectedSource.value === 'all') return base;
  return base.filter((s) => String(s.source_type ?? '') === selectedSource.value);
});

const orderedSegments = computed(() => {
  const base = [...sourceFilteredSegments.value].sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0));
  return base.filter((s) => {
    const hasNarrations = (narrationsBySegment.value.get(String(s.id)) ?? []).length > 0;
    const hasTags = (s.tags ?? []).length > 0;
    return hasNarrations || hasTags;
  });
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

      <!-- Filters: scroll horizontally when needed -->
      <div class="narration-filter-row -mx-1 flex items-center gap-2 overflow-x-auto whitespace-nowrap px-1">
        <button
          v-for="option in SOURCE_FILTERS"
          :key="option.value"
          type="button"
          class="text-[11px] transition cursor-pointer rounded-full px-3 py-1 ring-1 ring-black/10"
          :class="selectedSource === option.value
            ? 'bg-white text-black'
            : 'bg-zinc-200 text-black/70 hover:bg-white hover:text-black'"
          :title="option.value === 'all'
            ? 'Show all segment sources'
            : `Show only ${option.label} segments`"
          @click="setSelectedSource(option.value)"
        >
          {{ option.label }}
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
        <div class="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-white/5 transition">
          <button
            type="button"
            class="min-w-0 flex-1 flex items-center gap-2 text-left cursor-pointer"
            @click="emit('jumpToSegment', seg)"
          >
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
          </button>

          <div class="shrink-0 flex items-center gap-2">
            <div class="text-[11px] text-white/50" :title="`${(narrationsBySegment.get(String(seg.id)) ?? []).length} narration(s)`">
              {{ (narrationsBySegment.get(String(seg.id)) ?? []).length }}
            </div>

            <button
              type="button"
              class="flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80 transition cursor-pointer"
              title="Add narration"
              @click.stop="emit('addNarration', seg)"
            >
              <Icon icon="carbon:microphone" width="13" height="13" />
              Add narration
            </button>

            <button
              v-if="props.canModerateNarrations"
              type="button"
              class="flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80 transition cursor-pointer"
              title="Assign this segment"
              @click.stop="emit('assignSegment', seg)"
            >
              <Icon icon="carbon:task" width="13" height="13" />
              Assign
            </button>

            <button
              v-if="canAddQuickTags"
              type="button"
              class="text-[11px] text-white/50 hover:text-white/80 transition cursor-pointer"
              title="Add tags"
              @click.stop="toggleTagPanel(String(seg.id))"
            >
              + Tag
            </button>

            <button
              v-if="(narrationsBySegment.get(String(seg.id)) ?? []).length > 1"
              type="button"
              class="text-[11px] text-white/50 hover:text-white/80 transition cursor-pointer"
              @click.stop="toggleSegmentExpanded(String(seg.id))"
              :title="isSegmentExpanded(String(seg.id)) ? 'Collapse narrations' : 'Expand narrations'"
            >
              {{ isSegmentExpanded(String(seg.id)) ? 'Collapse' : 'Expand' }}
            </button>
          </div>
        </div>

        <div
          v-if="(narrationsBySegment.get(String(seg.id)) ?? []).length || (seg.tags?.length ?? 0) || isTagPanelOpen(String(seg.id))"
          class="border-t border-white/10"
        >
          <div class="px-3 py-2 space-y-2">
            <template v-if="(narrationsBySegment.get(String(seg.id)) ?? []).length">
              <div
                v-for="n in visibleNarrationsForSegment(String(seg.id))"
                :key="String((n as any).id)"
                class="rounded-md bg-black/25 ring-1 ring-white/5 p-2 transition cursor-pointer hover:bg-black/30 hover:ring-white/10"
                @click="emit('jumpToSegment', seg)"
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
                    @click.stop
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

              <div
                v-if="(narrationsBySegment.get(String(seg.id)) ?? []).length > 1 && !isSegmentExpanded(String(seg.id))"
                class="text-[11px] text-white/40"
              >
                Showing 1 of {{ (narrationsBySegment.get(String(seg.id)) ?? []).length }} narrations.
              </div>
            </template>

            <div
              v-if="(seg.tags?.length ?? 0) || isTagPanelOpen(String(seg.id))"
              class="pt-1 space-y-2"
            >
              <div v-if="(seg.tags?.length ?? 0)" class="flex flex-wrap gap-2">
                <div
                  v-for="tag in (seg.tags ?? [])"
                  :key="String(tag.id)"
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  :class="classForTag(tag)"
                >
                  <span>{{ formatTagLabel(tag.tag_key) }}</span>
                  <button
                    v-if="canRemoveTag(tag)"
                    type="button"
                    class="ml-1 text-[10px] text-white/70 hover:text-white"
                    title="Remove tag"
                    @click.stop="removeTag(seg, tag)"
                  >
                    x
                  </button>
                </div>
              </div>

              <div v-if="isTagPanelOpen(String(seg.id)) && canAddQuickTags" class="space-y-2">
                <div class="text-[10px] uppercase tracking-wide text-white/40">Action</div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="tagKey in ACTION_TAGS"
                    :key="tagKey"
                    type="button"
                    class="rounded-full px-2.5 py-1 text-[11px] ring-1 transition"
                    :class="segmentHasTag(seg, tagKey, 'action')
                      ? 'bg-white/15 text-white ring-white/20 cursor-not-allowed'
                      : 'bg-white/5 text-white/80 ring-white/10 hover:bg-white/10'"
                    :disabled="segmentHasTag(seg, tagKey, 'action')"
                    @click.stop="addQuickTag(seg, tagKey, 'action')"
                  >
                    {{ formatTagLabel(tagKey) }}
                  </button>
                </div>

                <div class="text-[10px] uppercase tracking-wide text-white/40">Context</div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="tagKey in CONTEXT_TAGS"
                    :key="tagKey"
                    type="button"
                    class="rounded-full px-2.5 py-1 text-[11px] ring-1 transition"
                    :class="segmentHasTag(seg, tagKey, 'context')
                      ? 'bg-white/15 text-white ring-white/20 cursor-not-allowed'
                      : 'bg-white/5 text-white/80 ring-white/10 hover:bg-white/10'"
                    :disabled="segmentHasTag(seg, tagKey, 'context')"
                    @click.stop="addQuickTag(seg, tagKey, 'context')"
                  >
                    {{ formatTagLabel(tagKey) }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.narration-filter-row {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge legacy */
}
.narration-filter-row::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}
</style>

<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { Icon } from '@iconify/vue';
import type { Narration, NarrationSourceType } from '@/modules/narrations/types/Narration';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';
import type { SegmentTag, SegmentTagType } from '@/modules/media/types/SegmentTag';
import { formatMinutesSeconds } from '@/lib/duration';
import type { NarrationListItem } from '@/modules/narration/composables/useNarrationRecorder';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { useNarrationSearch } from '@/modules/media/composables/useNarrationSearch';

const props = defineProps<{
  segments: MediaAssetSegment[];
  narrations: NarrationListItem[];
  activeSegmentId?: string | null;
  /** Segment to scroll into view when user seeks/selects. */
  focusedSegmentId?: string | null;
  /** Initial selection for the source filter. */
  defaultSource?: 'all' | 'coach' | 'staff' | 'member' | 'ai';
  /** Controlled selection for the source filter (keeps panels in sync). */
  sourceFilter?: 'all' | 'coach' | 'staff' | 'member' | 'ai' | null;
  /** Staff+ moderation capabilities. */
  canModerateNarrations?: boolean;
  /** Staff+ can assign segments. */
  canAssignSegments?: boolean;
  /** Staff+ can add/remove segment tags. */
  canTagSegments?: boolean;
  /** Staff+ can edit narrations. */
  canEditNarrations?: boolean;
  /** Staff+ can delete narrations. */
  canDeleteNarrations?: boolean;
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
  (e: 'update:sourceFilter', value: SourceFilter): void;
  (e: 'visibleSegmentsChange', segmentIds: string[]): void;
  (e: 'requestDeleteEmptySegments', segmentIds: string[]): void;
}>();

const editingNarrationId = ref<string | null>(null);
const editingText = ref('');

const ACTION_TAGS = ['tackle', 'carry', 'pass', 'kick', 'ruck_entry', 'cleanout'] as const;
const CONTEXT_TAGS = ['set_piece', 'lineout', 'scrum', 'counter_attack', 'transition', 'exit', 'wide_channel'] as const;
const HIDDEN_TAG_KEYS = new Set(['self']);

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

const canAddQuickTags = computed(() => Boolean(props.canTagSegments));

type SourceFilter = 'all' | NarrationSourceType;
type TagFilterOption = { key: string; type: SegmentTagType | null };

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

function isHiddenTagKey(tagKey: string | null | undefined): boolean {
  return HIDDEN_TAG_KEYS.has(String(tagKey ?? '').trim());
}

function classForTagType(tagType: SegmentTagType | null | undefined): string {
  const type = String(tagType ?? '');
  if (type === 'action') return 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-200/20';
  if (type === 'context') return 'bg-sky-500/15 text-sky-100 ring-1 ring-sky-200/20';
  if (type === 'identity') return 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-200/20';
  return 'bg-white/10 text-white/80 ring-1 ring-white/15';
}

function normalizeNarrationSourceType(value: unknown): NarrationSourceType {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'coach' || raw === 'staff' || raw === 'member' || raw === 'ai') {
    return raw as NarrationSourceType;
  }
  return 'member';
}

function narrationSourceTypeFor(item: NarrationListItem): NarrationSourceType {
  // Backwards compatibility: null/unknown source_type falls back to member.
  return normalizeNarrationSourceType(item.source_type);
}

function classForTag(tag: SegmentTag): string {
  return classForTagType(tag.tag_type);
}

function segmentHasTag(seg: MediaAssetSegment, tagKey: string, tagType: SegmentTagType): boolean {
  const tags = (seg.tags ?? []) as SegmentTag[];
  return tags.some((tag) => tag.tag_key === tagKey && tag.tag_type === tagType);
}

function segmentHasAnyTagKey(seg: MediaAssetSegment, tagKeys: Set<string>): boolean {
  if (!tagKeys.size) return false;
  const tags = (seg.tags ?? []) as SegmentTag[];
  return tags.some((tag) => {
    const key = String(tag.tag_key ?? '').trim();
    if (isHiddenTagKey(key)) return false;
    return tagKeys.has(key);
  });
}

function visibleSegmentTags(seg: MediaAssetSegment): SegmentTag[] {
  return (seg.tags ?? []).filter((tag) => !isHiddenTagKey(tag.tag_key));
}

function canRemoveTag(tag: SegmentTag): boolean {
  if (!props.canTagSegments) return false;
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

function canEditNarration(n: NarrationListItem): boolean {
  if (!props.canEditNarrations) return false;
  if (!isSavedNarration(n)) return false;
  return true;
}

function canDeleteNarration(n: NarrationListItem): boolean {
  if (!props.canDeleteNarrations) return false;
  if (!isSavedNarration(n)) return false;
  return true;
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
const showEmptyOnly = ref(false);
const activeTagFilters = ref<string[]>([]);
const tagFiltersExpanded = ref(true);
const tagFilterScrollEl = ref<HTMLElement | null>(null);

const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);
const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);

const {
  searchQuery,
  searchResults,
  searchLoading,
  searchError,
  searchMatchNarrationIds,
} = useNarrationSearch(activeOrgId, {
  segments: toRef(props, 'segments'),
  narrations: toRef(props, 'narrations'),
});

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
  emit('update:sourceFilter', next);
}

function toggleTagFilter(tagKey: string) {
  const key = String(tagKey ?? '').trim();
  if (!key) return;
  if (activeTagFilters.value.includes(key)) {
    activeTagFilters.value = activeTagFilters.value.filter((value) => value !== key);
  } else {
    activeTagFilters.value = [...activeTagFilters.value, key];
  }
}

function clearTagFilters() {
  activeTagFilters.value = [];
}

function toggleTagFiltersExpanded() {
  tagFiltersExpanded.value = !tagFiltersExpanded.value;
}

function scrollTagFilters(direction: 'left' | 'right') {
  const el = tagFilterScrollEl.value;
  if (!el) return;
  const amount = Math.max(160, Math.floor(el.clientWidth * 0.7));
  el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
}

watch(
  () => props.sourceFilter,
  (next) => {
    if (next === undefined || next === null) return;
    selectedSource.value = normalizeSource(next);
    hasSelectedSource.value = true;
  },
  { immediate: true }
);

watch(
  () => props.defaultSource,
  (next) => {
    if (props.sourceFilter !== undefined && props.sourceFilter !== null) return;
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

const filteredNarrationsBySegment = computed(() => {
  const map = new Map<string, NarrationListItem[]>();
  const matchIds = searchMatchNarrationIds.value;
  const shouldFilterMatches = Boolean(searchQuery.value.trim()) && matchIds && matchIds.size > 0;
  for (const [segId, list] of narrationsBySegment.value) {
    let filtered = selectedSource.value === 'all'
      ? list
      : list.filter((n) => narrationSourceTypeFor(n) === selectedSource.value);
    if (shouldFilterMatches) {
      filtered = filtered.filter((n) => matchIds.has(String((n as any)?.id ?? '')));
    }
    map.set(segId, filtered);
  }
  return map;
});

function narrationsForSegment(segId: string): NarrationListItem[] {
  return filteredNarrationsBySegment.value.get(String(segId)) ?? [];
}

function visibleNarrationsForSegment(segId: string): NarrationListItem[] {
  const list = narrationsForSegment(segId);
  if (list.length <= 1) return list;
  if (isSegmentExpanded(String(segId))) return list;
  return list.slice(0, 1);
}

const hasSearchQuery = computed(() => Boolean(searchQuery.value.trim()));

const displaySegments = computed(() => (hasSearchQuery.value ? searchResults.value : props.segments ?? []));

const tagFilterOptions = computed<TagFilterOption[]>(() => {
  const map = new Map<string, SegmentTagType | null>();
  for (const seg of props.segments ?? []) {
    for (const tag of (seg.tags ?? []) as SegmentTag[]) {
      const key = String(tag.tag_key ?? '').trim();
      if (!key || isHiddenTagKey(key) || map.has(key)) continue;
      map.set(key, tag.tag_type ?? null);
    }
  }

  for (const activeKey of activeTagFilters.value) {
    if (activeKey && !map.has(activeKey)) {
      map.set(activeKey, null);
    }
  }

  return Array.from(map, ([key, type]) => ({ key, type }));
});

const hasActiveTagFilters = computed(() => activeTagFilters.value.length > 0);
const shouldShowTagToggle = computed(() => tagFilterOptions.value.length > 0);

const activeTagFilterSet = computed(() => {
  const keys = activeTagFilters.value
    .map((key) => String(key ?? '').trim())
    .filter((key) => key && !isHiddenTagKey(key));
  return new Set(keys);
});

const tagFilteredSegments = computed(() => {
  const base = displaySegments.value ?? [];
  if (!activeTagFilterSet.value.size) return base;
  return base.filter((seg) => segmentHasAnyTagKey(seg, activeTagFilterSet.value));
});

const sourceFilteredSegments = computed(() => {
  const base = tagFilteredSegments.value ?? [];
  if (selectedSource.value === 'all' || showEmptyOnly.value) return base;
  // Filter by narration.source_type (not segment.source_type).
  return base.filter((s) => narrationsForSegment(String(s.id)).length > 0);
});

const orderedSegments = computed(() => {
  const base = [...sourceFilteredSegments.value].sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0));
  if (showEmptyOnly.value) {
    return base.filter((s) => narrationsForSegment(String(s.id)).length === 0);
  }
  return base.filter((s) => {
    const hasNarrations = narrationsForSegment(String(s.id)).length > 0;
    const hasTags = visibleSegmentTags(s).length > 0;
    return hasNarrations || hasTags;
  });
});

const orderedNarratedSegments = computed(() => {
  const base = [...sourceFilteredSegments.value].sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0));
  return base.filter((s) => narrationsForSegment(String(s.id)).length > 0);
});

const orderedNarratedSegmentIds = computed(() => orderedNarratedSegments.value.map((seg) => String(seg.id)));

watch(
  orderedNarratedSegmentIds,
  (next) => {
    emit('visibleSegmentsChange', next);
  },
  { immediate: true }
);

const visibleSegmentCount = computed(() => orderedSegments.value.length);
const totalSegmentCount = computed(() => sourceFilteredSegments.value.length);

const visibleNarrationCount = computed(() => {
  let count = 0;
  for (const seg of orderedSegments.value) {
    count += narrationsForSegment(String(seg.id)).length;
  }
  return count;
});

const emptySegmentIds = computed(() => {
  if (!showEmptyOnly.value) return [] as string[];
  return orderedSegments.value.map((seg) => String(seg.id));
});

function requestDeleteEmptySegments() {
  const ids = emptySegmentIds.value;
  if (!ids.length) return;
  emit('requestDeleteEmptySegments', ids);
}

// Display semantics: time range is primary; segment source is subtle metadata.
function formatSegmentTimeRange(seg: MediaAssetSegment): string {
  const start = formatMinutesSeconds(seg.start_seconds ?? 0);
  const end = formatMinutesSeconds(seg.end_seconds ?? 0);
  return `${start}–${end}`;
}

function formatSegmentSourceMeta(seg: MediaAssetSegment): string | null {
  const raw = String(seg.source_type ?? '').toLowerCase();
  if (!raw) return null;
  if (raw === 'auto') return 'Clipped automatically';
  if (raw === 'ai') return 'Clipped by AI';
  return `Clipped by ${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
}

// Display semantics: narration.source_type remains the primary authorship badge.
function formatNarrationSourceLabel(item: NarrationListItem): string {
  const source = narrationSourceTypeFor(item);
  if (source === 'ai') return 'AI';
  return `${source.charAt(0).toUpperCase()}${source.slice(1)}`;
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

      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Icon
            icon="carbon:search"
            width="14"
            height="14"
            class="absolute left-2 top-1/2 -translate-y-1/2 text-white/40"
          />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search narrations…"
            class="w-full rounded-md bg-white/5 py-1.5 pl-7 pr-3 text-sm text-white placeholder:text-white/30 ring-1 ring-white/10 focus:outline-none focus:ring-1 focus:ring-white/30"
            aria-label="Search narrations"
          />
        </div>
        <div
          v-if="searchLoading"
          class="h-4 w-4 animate-spin rounded-full border border-white/30 border-t-white/80"
          aria-label="Searching"
        />
      </div>

      <div v-if="searchError" class="text-[11px] text-rose-200/80">
        {{ searchError }}
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
            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'"
          :title="option.value === 'all'
            ? 'Show all narration sources'
            : `Show only ${option.label} narrations`"
          @click="setSelectedSource(option.value)"
        >
          {{ option.label }}
        </button>

        <button
          type="button"
          class="text-[11px] transition cursor-pointer rounded-full px-3 py-1 ring-1 ring-black/10"
          :class="showEmptyOnly
            ? 'bg-white text-black'
            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'"
          title="Show segments with no narrations"
          @click="showEmptyOnly = !showEmptyOnly"
        >
          Empty
        </button>
      </div>

      <div v-if="tagFilterOptions.length" class="space-y-1">
        <div class="flex items-start gap-2">
          <div class="relative flex-1 min-w-0 group">
            <div
              ref="tagFilterScrollEl"
              class="narration-filter-row flex w-full items-center gap-2 overflow-x-auto whitespace-nowrap py-1.5"
              :class="tagFiltersExpanded ? 'md:flex-wrap md:whitespace-normal md:overflow-visible' : ''"
              aria-label="Tag filters"
            >
              <button
                type="button"
                class="text-[11px] transition cursor-pointer rounded-full px-3 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                :class="!hasActiveTagFilters
                  ? 'bg-white text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'"
                title="Show all tags"
                @click="clearTagFilters"
              >
                All tags
              </button>

              <button
                v-for="tag in tagFilterOptions"
                :key="tag.key"
                type="button"
                class="cursor-pointer inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                :class="activeTagFilters.includes(tag.key)
                  ? 'bg-white text-black'
                  : `${classForTagType(tag.type)} hover:bg-white/20`"
                :aria-pressed="activeTagFilters.includes(tag.key)"
                :title="`Filter by ${formatTagLabel(tag.key)}`"
                @click="toggleTagFilter(tag.key)"
              >
                <span>{{ formatTagLabel(tag.key) }}</span>
                <span v-if="activeTagFilters.includes(tag.key)" class="text-[10px] text-black/60" aria-hidden="true">×</span>
              </button>
            </div>

            <div
              v-if="!tagFiltersExpanded"
              class="pointer-events-none absolute inset-y-0 left-0 right-0 hidden md:flex items-center justify-between"
            >
              <button
                type="button"
                class="pointer-events-auto ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white"
                aria-label="Scroll tags left"
                @click="scrollTagFilters('left')"
              >
                <Icon icon="carbon:chevron-left" width="16" height="16" />
              </button>
              <button
                type="button"
                class="pointer-events-auto mr-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white"
                aria-label="Scroll tags right"
                @click="scrollTagFilters('right')"
              >
                <Icon icon="carbon:chevron-right" width="16" height="16" />
              </button>
            </div>
          </div>

          <button
            v-if="shouldShowTagToggle"
            type="button"
            class="hidden md:inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/70 hover:bg-white/20 hover:text-white"
            :aria-expanded="tagFiltersExpanded"
            @click="toggleTagFiltersExpanded"
          >
            {{ tagFiltersExpanded ? 'Collapse' : 'Expand' }}
          </button>
        </div>
      </div>

      <div v-if="showEmptyOnly && props.canModerateNarrations" class="flex items-center justify-between text-[11px] text-white/60">
        <div>{{ orderedSegments.length }} empty segment{{ orderedSegments.length === 1 ? '' : 's' }}</div>
        <button
          type="button"
          class="rounded-full border border-rose-300/30 px-2.5 py-1 text-[11px] text-rose-100/90 hover:bg-rose-200/10 transition disabled:opacity-50"
          :disabled="orderedSegments.length === 0"
          title="Delete all empty segments in this view"
          @click="requestDeleteEmptySegments"
        >
          Delete empty segments
        </button>
      </div>
    </div>

    <div v-if="(props.segments ?? []).length === 0" class="text-sm text-white/50">
      No segments yet.
    </div>

    <div v-else-if="hasSearchQuery && !searchLoading && orderedSegments.length === 0" class="text-sm text-white/50">
      No narrations found.
    </div>

    <div v-else-if="!hasSearchQuery && orderedSegments.length === 0" class="text-sm text-white/50">
      {{ showEmptyOnly ? 'No empty segments.' : 'No narrations yet.' }}
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="seg in orderedSegments"
        :key="seg.id"
        class="rounded-lg border border-white/10 bg-white/5"
        :ref="(el) => setSegmentEl(String(seg.id), el)"
        :class="activeSegmentId && String(seg.id) === activeSegmentId ? 'border-l-2 border-l-yellow-300/60 bg-yellow-300/5' : ''"
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
            <div class="min-w-0">
              <!-- Segment label now prioritizes time range; source is secondary metadata. -->
              <div class="text-xs font-semibold text-white/80 truncate">
                {{ formatSegmentTimeRange(seg) }}
              </div>
              <div
                v-if="formatSegmentSourceMeta(seg)"
                class="text-[10px] text-white/40 truncate"
                :title="formatSegmentSourceMeta(seg) ?? ''"
              >
                {{ formatSegmentSourceMeta(seg) }}
              </div>
            </div>
          </button>

          <div class="shrink-0 flex items-center gap-2">
            <div class="text-[11px] text-white/50" :title="`${narrationsForSegment(String(seg.id)).length} narration(s)`">
              {{ narrationsForSegment(String(seg.id)).length }}
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
              v-if="props.canAssignSegments"
              type="button"
              class="flex items-center gap-1 text-[11px] text-white/50 hover:text-white/80 transition cursor-pointer"
              title="Assign this segment"
              @click.stop="emit('assignSegment', seg)"
            >
              <Icon icon="carbon:task" width="13" height="13" />
              Assign
            </button>

            <button
              v-if="props.canTagSegments"
              type="button"
              class="text-[11px] text-white/50 hover:text-white/80 transition cursor-pointer"
              title="Add tags"
              @click.stop="toggleTagPanel(String(seg.id))"
            >
              + Tag
            </button>

            <button
              v-if="narrationsForSegment(String(seg.id)).length > 1"
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
          v-if="narrationsForSegment(String(seg.id)).length || visibleSegmentTags(seg).length || isTagPanelOpen(String(seg.id))"
          class="border-t border-white/10"
        >
          <div class="space-y-2">
            <template v-if="narrationsForSegment(String(seg.id)).length">
              <div
                v-for="n in visibleNarrationsForSegment(String(seg.id))"
                :key="String((n as any).id)"
                class="group cursor-pointer px-3 py-2 transition hover:bg-white/5 border-t border-white/10 first:border-t-0"
                @click="emit('jumpToSegment', seg)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <span
                      class="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70 ring-1 ring-white/10"
                      :title="`Narration by ${formatNarrationSourceLabel(n)}`"
                    >
                      {{ formatNarrationSourceLabel(n) }}
                    </span>
                    <div class="text-[10px] font-mono text-white/35">
                      {{ formatCreatedAt((n as any).created_at) }}
                    </div>
                  </div>

                  <div class="flex items-center gap-2 opacity-40 transition group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      v-if="canEditNarration(n)"
                      type="button"
                      class="text-[11px] text-white/50 hover:text-white/80 transition"
                      @click.stop="startEditing(n as any)"
                    >
                      Edit
                    </button>
                    <button
                      v-if="canDeleteNarration(n)"
                      type="button"
                      class="text-[11px] text-rose-200/70 hover:text-rose-200 transition"
                      @click.stop="requestDelete(n as any)"
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
                v-if="narrationsForSegment(String(seg.id)).length > 1 && !isSegmentExpanded(String(seg.id))"
                class="px-3 text-[11px] text-white/40"
              >
                Showing 1 of {{ narrationsForSegment(String(seg.id)).length }} narrations.
              </div>
            </template>

            <div
              v-if="visibleSegmentTags(seg).length || isTagPanelOpen(String(seg.id))"
              class="px-3 pb-2 pt-1 space-y-2"
            >
              <div v-if="visibleSegmentTags(seg).length" class="flex flex-wrap gap-2">
                <div
                  v-for="tag in visibleSegmentTags(seg)"
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

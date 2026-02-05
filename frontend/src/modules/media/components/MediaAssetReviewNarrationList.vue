<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { Icon } from '@iconify/vue';
import type { Narration, NarrationSourceType } from '@/modules/narrations/types/Narration';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';
import type { SegmentTag, SegmentTagType } from '@/modules/media/types/SegmentTag';
import { formatMinutesSeconds } from '@/lib/duration';
import type { NarrationListItem } from '@/modules/narrations/composables/useNarrationRecorder';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { useNarrationSearch } from '@/modules/media/composables/useNarrationSearch';
import NarrationRow from './NarrationRow.vue';
import NarrationFilterPanel from './NarrationFilterPanel.vue';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import type { OrgRole } from '@/modules/orgs/types/OrgRole';

const props = defineProps<{
  segments: MediaAssetSegment[];
  narrations: NarrationListItem[];
  activeSegmentId?: string | null;
  focusedSegmentId?: string | null;
  defaultSource?: 'all' | 'coach' | 'staff' | 'member';
  sourceFilter?: 'all' | 'coach' | 'staff' | 'member' | null;
  canModerateNarrations?: boolean;
  canAssignSegments?: boolean;
  canTagSegments?: boolean;
  canEditNarrations?: boolean;
  canDeleteNarrations?: boolean;
  currentUserId?: string | null;
  currentUserRole?: OrgRole | null;
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

// Delete confirmation state
const showDeleteConfirm = ref(false);
const narrationToDelete = ref<Narration | null>(null);
const isDeleting = ref(false);

const SET_PIECE_TAGS = ['scrum', 'lineout', 'kickoff', 'restart'] as const;
const ACTION_TAGS = ['carry', 'pass', 'kick', 'tackle', 'breakdown', 'maul'] as const;
const CONTEXT_TAGS = ['exit', 'counter_attack', 'transition', 'broken_play'] as const;
const HIDDEN_TAG_KEYS = new Set(['self']);

const tagPanelOpenIds = ref(new Set<string>());
const expandedSegmentIds = ref(new Set<string>());

function isSegmentExpanded(segmentId: string): boolean {
  return expandedSegmentIds.value.has(segmentId);
}

function toggleSegmentExpanded(segmentId: string) {
  const set = expandedSegmentIds.value;
  const tagSet = tagPanelOpenIds.value;
  
  if (set.has(segmentId)) {
    // User is collapsing this segment
    set.delete(segmentId);
    
    // Auto-close its tag panel
    if (tagSet.has(segmentId)) {
      tagSet.delete(segmentId);
    }
  } else {
    // User is expanding this segment (accordion: close all others)
    set.clear();
    set.add(segmentId);
    
    // Close all other tag panels (keep only this one if it's open)
    const currentlyOpen = tagSet.has(segmentId);
    tagSet.clear();
    if (currentlyOpen) {
      tagSet.add(segmentId);
    }
  }
  
  expandedSegmentIds.value = new Set(set);
  tagPanelOpenIds.value = new Set(tagSet);
}

function isTagPanelOpen(segmentId: string): boolean {
  return tagPanelOpenIds.value.has(segmentId);
}

function collapseAllSegments() {
  expandedSegmentIds.value = new Set();
}

function toggleTagPanel(segmentId: string) {
  const set = tagPanelOpenIds.value;
  
  if (set.has(segmentId)) {
    // Closing tag panel on this segment
    set.delete(segmentId);
  } else {
    // Opening tag panel on this segment
    // Accordion: collapse all other segments and close all other tag panels
    collapseAllSegments();
    set.clear();
    set.add(segmentId);
  }
  
  tagPanelOpenIds.value = new Set(set);
}

const canAddQuickTags = computed(() => Boolean(props.canTagSegments));

function handleSegmentClick(segment: MediaAssetSegment) {
  const segmentId = String(segment.id);
  
  // Accordion: collapse all expanded segments when clicking any segment
  collapseAllSegments();
  
  // Close all tag panels except the one being clicked
  tagPanelOpenIds.value = new Set([segmentId]);
  
  // Emit to parent to jump to this segment
  emit('jumpToSegment', segment);
}

type SourceFilter = 'all' | NarrationSourceType;
type TagFilterOption = { key: string; type: SegmentTagType | null };

function formatTagLabel(tagKey: string): string {
  return String(tagKey ?? '').replace(/_/g, ' ');
}

function isHiddenTagKey(tagKey: string | null | undefined): boolean {
  return HIDDEN_TAG_KEYS.has(String(tagKey ?? '').trim());
}

function normalizeNarrationSourceType(value: unknown): NarrationSourceType {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'coach' || raw === 'staff' || raw === 'member') {
    return raw as NarrationSourceType;
  }
  return 'member';
}

function narrationSourceTypeFor(item: NarrationListItem): NarrationSourceType {
  return normalizeNarrationSourceType(item.source_type);
}

function classForTag(tag: SegmentTag): string {
  void tag.tag_type;
  return 'bg-slate-700/50 text-slate-300';
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
  return !(n as any)?.status;
}

function isSavedNarration(n: NarrationListItem): n is Narration {
  return !(n as any).status;
}

function isStaffRole(role: OrgRole | null): boolean {
  if (!role) return false;
  return role === 'owner' || role === 'manager' || role === 'staff';
}

function canEditNarration(n: NarrationListItem): boolean {
  if (!props.canEditNarrations) return false;
  if (!isSavedNarration(n)) return false;
  if (!props.currentUserId) return false;
  
  // Staff can edit any narration
  if (isStaffRole(props.currentUserRole)) return true;
  
  // Members can only edit their own
  return n.author_id === props.currentUserId;
}

function canDeleteNarration(n: NarrationListItem): boolean {
  if (!props.canDeleteNarrations) return false;
  if (!isSavedNarration(n)) return false;
  if (!props.currentUserId) return false;
  
  // Staff can delete any narration
  if (isStaffRole(props.currentUserRole)) return true;
  
  // Members can only delete their own
  return n.author_id === props.currentUserId;
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
  narrationToDelete.value = n;
  showDeleteConfirm.value = true;
}

function closeDeleteConfirm() {
  if (isDeleting.value) return;
  showDeleteConfirm.value = false;
  narrationToDelete.value = null;
}

async function confirmDelete() {
  if (!narrationToDelete.value) return;
  isDeleting.value = true;
  try {
    emit('deleteNarration', String(narrationToDelete.value.id));
    if (editingNarrationId.value === String(narrationToDelete.value.id)) {
      cancelEditing();
    }
    showDeleteConfirm.value = false;
    narrationToDelete.value = null;
  } finally {
    isDeleting.value = false;
  }
}

const selectedSource = ref<SourceFilter>('all');
const hasSelectedSource = ref(false);
const showEmptyOnly = ref(false);
const activeTagFilters = ref<string[]>([]);

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
  if (raw === 'coach' || raw === 'staff' || raw === 'member') {
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
const listScrollEl = ref<HTMLElement | null>(null);

function setSegmentEl(id: string, el: unknown) {
  if (!id) return;
  const map = segmentElById.value;
  if (!el) {
    map.delete(id);
    return;
  }

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
  if (!el) return;

  const container = listScrollEl.value;
  if (container && container.scrollHeight > container.clientHeight) {
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offset = elRect.top - containerRect.top;
    const targetTop = container.scrollTop + offset - container.clientHeight / 2 + elRect.height / 2;
    container.scrollTo({ top: targetTop, behavior: 'smooth' });
    return;
  }

  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
}

watch(
  () => [props.focusedSegmentId, props.activeSegmentId],
  () => {
    void scrollActiveIntoView();
  }
);

// Watch activeSegmentId to apply accordion behavior when timeline changes
watch(
  () => props.activeSegmentId,
  (newActiveId) => {
    if (!newActiveId) return;
    
    // Apply same accordion behavior as clicking a segment
    collapseAllSegments();
    
    // Auto-open tags for the active segment
    tagPanelOpenIds.value = new Set([newActiveId]);
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

function allNarrationsForSegment(segId: string): NarrationListItem[] {
  return narrationsBySegment.value.get(String(segId)) ?? [];
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
  return base.filter((s) => narrationsForSegment(String(s.id)).length > 0);
});

const orderedSegments = computed(() => {
  const base = [...sourceFilteredSegments.value].sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0));
  if (showEmptyOnly.value) {
    return base.filter((s) => allNarrationsForSegment(String(s.id)).length === 0);
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

function formatSegmentTimeRange(seg: MediaAssetSegment): string {
  const start = formatMinutesSeconds(seg.start_seconds ?? 0);
  const end = formatMinutesSeconds(seg.end_seconds ?? 0);
  return `${start}–${end}`;
}

function formatSegmentSourceMeta(seg: MediaAssetSegment): string | null {
  const raw = String(seg.source_type ?? '').toLowerCase();
  if (!raw) return null;
  if (raw === 'auto') return 'Auto-clipped';
  if (raw === 'ai') return 'AI-clipped';
  return `Clipped by ${raw}`;
}

</script>

<template>
  <div
    ref="listScrollEl"
    class="space-y-6 md:max-h-[calc(100dvh-var(--main-nav-height)-6rem)] md:overflow-y-auto md:overscroll-contain md:pr-2"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <div class="text-lg font-semibold text-slate-50">Narrations</div>
        <span class="ml-2 text-xs font-medium text-slate-400">
          {{ visibleNarrationCount }}
        </span>
      </div>
      <div class="text-xs text-slate-400">
        {{ visibleSegmentCount }} segment{{ visibleSegmentCount === 1 ? '' : 's' }} • {{ visibleNarrationCount }} narration{{ visibleNarrationCount === 1 ? '' : 's' }}
      </div>
    </div>

    <!-- Filter Panel -->
    <NarrationFilterPanel
      :selected-source="selectedSource"
      :active-tag-filters="activeTagFilters"
      :tag-filter-options="tagFilterOptions"
      :show-empty-only="showEmptyOnly"
      :search-query="searchQuery"
      :search-loading="searchLoading"
      :search-error="searchError"
      @update:selected-source="setSelectedSource"
      @update:show-empty-only="(v) => showEmptyOnly = v"
      @update:search-query="(v) => searchQuery = v"
      @toggle-tag-filter="toggleTagFilter"
      @clear-tag-filters="clearTagFilters"
    />

    <!-- Empty segment bulk actions -->
    <div v-if="showEmptyOnly && props.canModerateNarrations && orderedSegments.length > 0" 
         class="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-2">
      <div class="text-sm text-slate-400">
        {{ orderedSegments.length }} empty segment{{ orderedSegments.length === 1 ? '' : 's' }}
      </div>
      <button
        type="button"
        class="rounded border border-rose-400/30 px-3 py-1 text-xs text-rose-300 hover:bg-rose-400/10 transition"
        @click="requestDeleteEmptySegments"
      >
        Delete all
      </button>
    </div>

    <div v-if="showEmptyOnly" class="rounded-lg border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
      Empty segments happen when all narrations have been deleted from a moment
    </div>

    <!-- Empty states -->
    <div v-if="(props.segments ?? []).length === 0" class="text-center py-12 text-slate-400">
      No segments yet
    </div>

    <div v-else-if="hasSearchQuery && searchLoading" class="flex items-center justify-center gap-3 py-12 text-slate-300">
      <LoadingDot />
      <ShimmerText text="Searching your narrations…" />
    </div>

    <div v-else-if="hasSearchQuery && !searchLoading && orderedSegments.length === 0" 
         class="text-center py-12 text-slate-400">
      No narrations found
    </div>

    <div v-else-if="!hasSearchQuery && orderedSegments.length === 0" 
         class="text-center py-12 text-slate-400">
      <div v-if="showEmptyOnly" class="space-y-2">
        <div>No empty segments</div>
        <div class="text-xs text-slate-500">Empty segments happen when all narrations have been deleted from a moment</div>
      </div>
      <div v-else>No narrations yet</div>
    </div>

    <!-- Segment List -->
    <div v-else class="space-y-4">
      <div
        v-for="seg in orderedSegments"
        :key="seg.id"
        :ref="(el) => setSegmentEl(String(seg.id), el)"
        class="rounded-lg border border-slate-700/50 bg-slate-800/30 overflow-hidden transition-colors"
        :class="activeSegmentId && String(seg.id) === activeSegmentId ? 'ring-1 ring-blue-400/30' : ''"
      >
        <!-- Segment Header -->
        <div class="px-4 py-3 flex items-center justify-between border-b border-slate-700/50">
          <button
            type="button"
            class="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
            @click="handleSegmentClick(seg)"
          >
            <div
              v-if="activeSegmentId && String(seg.id) === activeSegmentId"
              class="shrink-0 rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300"
            >
              Now
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-slate-50">
                {{ formatSegmentTimeRange(seg) }}
              </div>
              <div v-if="formatSegmentSourceMeta(seg)" class="text-xs text-slate-400">
                {{ formatSegmentSourceMeta(seg) }}
              </div>
            </div>
          </button>

          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs text-slate-400">
              {{ narrationsForSegment(String(seg.id)).length }}
            </span>

            <button
              type="button"
              class="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition"
              @click.stop="emit('addNarration', seg)"
            >
              <Icon icon="carbon:microphone" width="14" height="14" />
              <span>Add</span>
            </button>

            <button
              v-if="props.canAssignSegments"
              type="button"
              class="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition"
              @click.stop="emit('assignSegment', seg)"
            >
              <Icon icon="carbon:task" width="14" height="14" />
            </button>

            <button
              v-if="props.canTagSegments"
              type="button"
              class="text-xs text-slate-400 hover:text-slate-200 transition"
              @click.stop="toggleTagPanel(String(seg.id))"
            >
              <Icon icon="carbon:tag" width="14" height="14" />
            </button>

            <button
              v-if="narrationsForSegment(String(seg.id)).length > 1"
              type="button"
              class="text-xs text-slate-400 hover:text-slate-200 transition"
              @click.stop="toggleSegmentExpanded(String(seg.id))"
            >
              <Icon 
                :icon="isSegmentExpanded(String(seg.id)) ? 'carbon:chevron-up' : 'carbon:chevron-down'" 
                width="14" 
                height="14" 
              />
            </button>
          </div>
        </div>

        <!-- Narrations -->
        <div v-if="narrationsForSegment(String(seg.id)).length > 0" class="divide-y divide-slate-700/50">
          <NarrationRow
            v-for="n in visibleNarrationsForSegment(String(seg.id))"
            :key="String((n as any).id)"
            :narration="n"
            :is-active="Boolean(activeSegmentId && String(seg.id) === activeSegmentId)"
            :is-editing="isSavedNarration(n) && editingNarrationId === String(n.id)"
            :edit-text="editingText"
            :can-edit="canEditNarration(n)"
            :can-delete="canDeleteNarration(n)"
            @click="handleSegmentClick(seg)"
            @edit="startEditing(n as any)"
            @delete="requestDelete(n as any)"
            @cancel-edit="cancelEditing"
            @save-edit="(text) => { editingText = text; saveEditing(n as any); }"
            @update:edit-text="(text) => editingText = text"
          />

          <div
            v-if="narrationsForSegment(String(seg.id)).length > 1 && !isSegmentExpanded(String(seg.id))"
            class="px-4 py-2 text-xs text-slate-400"
          >
            Showing 1 of {{ narrationsForSegment(String(seg.id)).length }} • 
            <button 
              type="button"
              class="text-blue-400 hover:text-blue-300"
              @click="toggleSegmentExpanded(String(seg.id))"
            >
              Show all
            </button>
          </div>
        </div>

        <!-- Tags -->
        <div
          v-if="visibleSegmentTags(seg).length || isTagPanelOpen(String(seg.id))"
          class="px-4 py-3 border-t border-slate-700/50 bg-yellow-900/40 space-y-3"
        >
          <div v-if="visibleSegmentTags(seg).length" class="flex flex-wrap gap-2">
            <div
              v-for="tag in visibleSegmentTags(seg)"
              :key="String(tag.id)"
              class="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide"
              :class="classForTag(tag)"
            >
              <span>{{ formatTagLabel(tag.tag_key) }}</span>
              <button
                v-if="canRemoveTag(tag)"
                type="button"
                class="text-slate-400 hover:text-slate-200"
                @click.stop="removeTag(seg, tag)"
              >
                <Icon icon="carbon:close" width="10" height="10" />
              </button>
            </div>
          </div>

          <div v-if="isTagPanelOpen(String(seg.id)) && canAddQuickTags" class="space-y-3">
            <div>
              <div class="text-xs uppercase tracking-wide text-slate-400 mb-2">Set Piece / Restarts</div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tagKey in SET_PIECE_TAGS"
                  :key="tagKey"
                  type="button"
                  class="rounded px-2.5 py-1 text-xs uppercase tracking-wide transition"
                  :class="segmentHasTag(seg, tagKey, 'context')
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'"
                  :disabled="segmentHasTag(seg, tagKey, 'context')"
                  @click.stop="addQuickTag(seg, tagKey, 'context')"
                >
                  {{ formatTagLabel(tagKey) }}
                </button>
              </div>
            </div>

            <div>
              <div class="text-xs uppercase tracking-wide text-slate-400 mb-2">Action</div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tagKey in ACTION_TAGS"
                  :key="tagKey"
                  type="button"
                  class="rounded px-2.5 py-1 text-xs uppercase tracking-wide transition"
                  :class="segmentHasTag(seg, tagKey, 'action')
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'"
                  :disabled="segmentHasTag(seg, tagKey, 'action')"
                  @click.stop="addQuickTag(seg, tagKey, 'action')"
                >
                  {{ formatTagLabel(tagKey) }}
                </button>
              </div>
            </div>

            <div>
              <div class="text-xs uppercase tracking-wide text-slate-400 mb-2">Context</div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tagKey in CONTEXT_TAGS"
                  :key="tagKey"
                  type="button"
                  class="rounded px-2.5 py-1 text-xs uppercase tracking-wide transition"
                  :class="segmentHasTag(seg, tagKey, 'context')
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'"
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

  <!-- Delete Confirmation Modal -->
  <ConfirmDeleteModal
    :show="showDeleteConfirm"
    :item-name="'this narration'"
    popup-title="Delete Narration"
    :is-deleting="isDeleting"
    @confirm="confirmDelete"
    @cancel="closeDeleteConfirm"
    @close="closeDeleteConfirm"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { Icon } from '@iconify/vue';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import type { Narration, NarrationSourceType, NarrationWithAuthor } from '@/modules/narrations/types/Narration';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';
import type { SegmentTag, SegmentTagType } from '@/modules/media/types/SegmentTag';
import type { SegmentTagSuggestion } from '@/modules/media/types/SegmentTagSuggestion';
import type { SegmentInsight } from '@/modules/analysis/types/SegmentInsight';
import { formatMinutesSeconds } from '@/lib/duration';
import type { NarrationListItem } from '@/modules/narrations/composables/useNarrationRecorder';
import { orgService } from '@/modules/orgs/services/orgServiceV2';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { useNarrationSearch } from '@/modules/media/composables/useNarrationSearch';
import { MIN_SEGMENT_DURATION_SECONDS } from '@/modules/media/services/segmentService';
import type { OrgMember } from '@/modules/orgs/types';
import NarrationRow from './NarrationRow.vue';
import NarrationFilterPanel from './NarrationFilterPanel.vue';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import SegmentActionsMenu from '@/components/SegmentActionsMenu.vue';
import type { OrgRole } from '@/modules/orgs/types/OrgRole';
import { animateMini } from 'motion';

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
  canTagPlayers?: boolean;
  canAutoTagSegments?: boolean;
  autoTaggingSegmentIds?: string[];
  tagSuggestions?: Record<string, SegmentTagSuggestion[]>;
  segmentInsights?: Record<string, SegmentInsight & { narration_count_at_generation?: number | null }>;
  canGenerateSegmentInsights?: boolean;
  insightGeneratingSegmentIds?: string[];
  canEditNarrations?: boolean;
  canDeleteNarrations?: boolean;
  canEditSegmentTiming?: boolean;
  mediaDurationSeconds?: number;
  currentUserId?: string | null;
  currentUserRole?: OrgRole | null;
  showCloseButton?: boolean;
  scrollTop?: number;
}>();

const emit = defineEmits<{
  (e: 'jumpToSegment', segment: MediaAssetSegment): void;
  (e: 'addNarration', segment: MediaAssetSegment): void;
  (e: 'assignSegment', segment: MediaAssetSegment): void;
  (e: 'addToPlaylist', segment: MediaAssetSegment): void;
  (e: 'editNarration', narrationId: string, transcriptRaw: string): void;
  (e: 'deleteNarration', narrationId: string): void;
  (e: 'deleteSegment', segmentId: string): void;
  (e: 'updateSegmentTiming', payload: { segmentId: string; startSeconds: number; endSeconds: number }): void;
  (e: 'seekToSeconds', seconds: number): void;
  (e: 'addTag', payload: { segmentId: string; tagKey: string; tagType: SegmentTagType; taggedProfileId?: string }): void;
  (e: 'removeTag', payload: { segmentId: string; tagId: string }): void;
  (e: 'autoTagSegment', segment: MediaAssetSegment): void;
  (e: 'applySuggestedTags', payload: { segmentId: string; suggestionIds?: string[]; applyAll?: boolean }): void;
  (e: 'rejectSuggestedTag', payload: { segmentId: string; suggestionId: string }): void;
  (e: 'generateSegmentInsight', payload: { segmentId: string }): void;
  (e: 'update:sourceFilter', value: SourceFilter): void;
  (e: 'visibleSegmentsChange', segmentIds: string[]): void;
  (e: 'requestDeleteEmptySegments', segmentIds: string[]): void;
  (e: 'update:scrollTop', scrollTop: number): void;
  (e: 'closePanel'): void;
}>();

const editingNarrationId = ref<string | null>(null);
const editingText = ref('');

// Delete confirmation state
const showDeleteConfirm = ref(false);
const narrationToDelete = ref<Narration | null>(null);
const isDeleting = ref(false);

// Segment delete confirmation state
const showSegmentDeleteConfirm = ref(false);
const segmentToDelete = ref<MediaAssetSegment | null>(null);
const isDeletingSegment = ref(false);
const editingTimingSegmentId = ref<string | null>(null);
const timingStartSeconds = ref(0);
const timingEndSeconds = ref(0);
const timingWindowStartSeconds = ref(0);
const timingWindowEndSeconds = ref(0);
const timingSeekDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const TIMING_WINDOW_STEP_SECONDS = 5;
const TIMING_WINDOW_EDGE_EPSILON = 0.05;
const TIMING_SEEK_DEBOUNCE_MS = 450;

function emitDebouncedTimingSeek(seconds: number) {
  if (timingSeekDebounceTimer.value) {
    clearTimeout(timingSeekDebounceTimer.value);
  }
  const nextSeconds = Math.max(0, Number(seconds) || 0);
  timingSeekDebounceTimer.value = setTimeout(() => {
    emit('seekToSeconds', nextSeconds);
  }, TIMING_SEEK_DEBOUNCE_MS);
}

onBeforeUnmount(() => {
  if (timingSeekDebounceTimer.value) {
    clearTimeout(timingSeekDebounceTimer.value);
  }
});

// Tagging modal state
const showTagModal = ref(false);
const tagModalSegmentId = ref<string | null>(null);
const selectedMember = ref<OrgMember | null>(null);
const memberQuery = ref('');
const members = ref<OrgMember[]>([]);
const membersLoading = ref(false);
const membersError = ref<string | null>(null);
const tagModalError = ref<string | null>(null);

const SET_PIECE_TAGS = ['scrum', 'lineout', 'kickoff', 'restart'] as const;
const ACTION_TAGS = ['carry', 'pass', 'kick', 'tackle', 'breakdown', 'maul'] as const;
const CONTEXT_TAGS = ['exit', 'counter_attack', 'transition', 'broken_play'] as const;
const HIDDEN_TAG_KEYS = new Set(['self']);

const expandedSegmentIds = ref(new Set<string>());

function isSegmentExpanded(segmentId: string): boolean {
  return expandedSegmentIds.value.has(segmentId);
}

function toggleSegmentExpanded(segmentId: string): boolean {
  const set = expandedSegmentIds.value;
  
  if (set.has(segmentId)) {
    // User is collapsing this segment
    set.delete(segmentId);
  } else {
    // User is expanding this segment (accordion: close all others)
    set.clear();
    set.add(segmentId);
  }
  
  expandedSegmentIds.value = new Set(set);
  return set.has(segmentId);
}
const canOpenTagModal = computed(() => Boolean(
  props.canTagSegments || props.canTagPlayers || props.canAutoTagSegments
));
const canAddQuickTags = computed(() => Boolean(props.canTagSegments));

function handleSegmentHeaderClick(segment: MediaAssetSegment) {
  const segmentId = String(segment.id);
  const isNowExpanded = toggleSegmentExpanded(segmentId);
  if (!isNowExpanded || editingTimingSegmentId.value !== segmentId) {
    closeTimingEditor();
  }
  emit('jumpToSegment', segment);
}

function handleNarrationClick(segment: MediaAssetSegment) {
  emit('jumpToSegment', segment);
}

function clampToDuration(seconds: number): number {
  const duration = Number(props.mediaDurationSeconds ?? 0);
  if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, seconds);
  return Math.max(0, Math.min(seconds, duration));
}

function openTimingEditor(seg: MediaAssetSegment) {
  if (!props.canEditSegmentTiming) return;
  editingTimingSegmentId.value = String(seg.id);
  const start = clampToDuration(Number(seg.start_seconds ?? 0));
  const end = clampToDuration(Math.max(Number(seg.end_seconds ?? 0), start));
  const paddingSeconds = 5;
  const duration = Number(props.mediaDurationSeconds ?? 0);
  const hasDuration = Number.isFinite(duration) && duration > 0;
  const nextWindowStart = Math.max(0, start - paddingSeconds);
  const unclampedWindowEnd = end + paddingSeconds;
  const nextWindowEnd = hasDuration
    ? Math.min(duration, Math.max(unclampedWindowEnd, nextWindowStart + MIN_SEGMENT_DURATION_SECONDS))
    : Math.max(unclampedWindowEnd, nextWindowStart + MIN_SEGMENT_DURATION_SECONDS);
  timingWindowStartSeconds.value = nextWindowStart;
  timingWindowEndSeconds.value = nextWindowEnd;
  timingStartSeconds.value = Math.max(nextWindowStart, Math.min(start, nextWindowEnd));
  timingEndSeconds.value = Math.max(timingStartSeconds.value, Math.min(end, nextWindowEnd));
  if (timingEndSeconds.value - timingStartSeconds.value < MIN_SEGMENT_DURATION_SECONDS) {
    timingEndSeconds.value = Math.min(nextWindowEnd, timingStartSeconds.value + MIN_SEGMENT_DURATION_SECONDS);
    if (timingEndSeconds.value - timingStartSeconds.value < MIN_SEGMENT_DURATION_SECONDS) {
      timingStartSeconds.value = Math.max(nextWindowStart, timingEndSeconds.value - MIN_SEGMENT_DURATION_SECONDS);
    }
  }
}

function closeTimingEditor() {
  editingTimingSegmentId.value = null;
}

function isTimingEditorOpen(segId: string): boolean {
  return editingTimingSegmentId.value === String(segId);
}

function clampToTimingWindow(seconds: number): number {
  return Math.max(timingWindowStartSeconds.value, Math.min(seconds, timingWindowEndSeconds.value));
}

function canExpandTimingWindowRight(): boolean {
  const duration = Number(props.mediaDurationSeconds ?? 0);
  if (!Number.isFinite(duration) || duration <= 0) return true;
  return timingWindowEndSeconds.value < duration;
}

function expandTimingWindowLeft() {
  timingWindowStartSeconds.value = Math.max(0, timingWindowStartSeconds.value - TIMING_WINDOW_STEP_SECONDS);
}

function expandTimingWindowRight() {
  const duration = Number(props.mediaDurationSeconds ?? 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    timingWindowEndSeconds.value += TIMING_WINDOW_STEP_SECONDS;
    return;
  }
  timingWindowEndSeconds.value = Math.min(duration, timingWindowEndSeconds.value + TIMING_WINDOW_STEP_SECONDS);
}

function timingWindowRange(): number {
  return Math.max(0.001, timingWindowEndSeconds.value - timingWindowStartSeconds.value);
}

function timingSelectionLeftPercent(): number {
  return ((timingStartSeconds.value - timingWindowStartSeconds.value) / timingWindowRange()) * 100;
}

function timingSelectionRightPercent(): number {
  return ((timingWindowEndSeconds.value - timingEndSeconds.value) / timingWindowRange()) * 100;
}

function timingSelectionEndPercent(): number {
  return 100 - timingSelectionRightPercent();
}

function onStartSliderInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;
  if (
    parsed <= timingWindowStartSeconds.value + TIMING_WINDOW_EDGE_EPSILON &&
    timingWindowStartSeconds.value > 0
  ) {
    expandTimingWindowLeft();
  }
  const clamped = clampToTimingWindow(parsed);
  const maxAllowedStart = Math.max(timingWindowStartSeconds.value, timingEndSeconds.value - MIN_SEGMENT_DURATION_SECONDS);
  timingStartSeconds.value = Math.min(clamped, maxAllowedStart);
  const minAllowedEnd = timingStartSeconds.value + MIN_SEGMENT_DURATION_SECONDS;
  if (timingEndSeconds.value < minAllowedEnd) {
    timingEndSeconds.value = Math.min(timingWindowEndSeconds.value, minAllowedEnd);
    if (timingEndSeconds.value - timingStartSeconds.value < MIN_SEGMENT_DURATION_SECONDS) {
      timingStartSeconds.value = Math.max(
        timingWindowStartSeconds.value,
        timingEndSeconds.value - MIN_SEGMENT_DURATION_SECONDS
      );
    }
  }
  emitDebouncedTimingSeek(timingStartSeconds.value);
}

function onEndSliderInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;
  if (
    parsed >= timingWindowEndSeconds.value - TIMING_WINDOW_EDGE_EPSILON &&
    canExpandTimingWindowRight()
  ) {
    expandTimingWindowRight();
  }
  const clamped = clampToTimingWindow(parsed);
  const minAllowedEnd = timingStartSeconds.value + MIN_SEGMENT_DURATION_SECONDS;
  timingEndSeconds.value = Math.min(timingWindowEndSeconds.value, Math.max(clamped, minAllowedEnd));
  if (timingEndSeconds.value - timingStartSeconds.value < MIN_SEGMENT_DURATION_SECONDS) {
    timingStartSeconds.value = Math.max(
      timingWindowStartSeconds.value,
      timingEndSeconds.value - MIN_SEGMENT_DURATION_SECONDS
    );
  }
  emitDebouncedTimingSeek(timingEndSeconds.value);
}

function applyTimingUpdate(seg: MediaAssetSegment) {
  emit('updateSegmentTiming', {
    segmentId: String(seg.id),
    startSeconds: timingStartSeconds.value,
    endSeconds: timingEndSeconds.value,
  });
  closeTimingEditor();
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

function insightForSegment(segId: string) {
  return props.segmentInsights?.[String(segId)] ?? null;
}

function classForTag(tag: SegmentTag): string {
  void tag.tag_type;
  return 'bg-slate-700/50 text-slate-300';
}

function segmentHasTag(seg: MediaAssetSegment, tagKey: string, tagType: SegmentTagType): boolean {
  const tags = (seg.tags ?? []) as SegmentTag[];
  return tags.some((tag) => tag.tag_key === tagKey && tag.tag_type === tagType);
}

function segmentTagFor(seg: MediaAssetSegment, tagKey: string, tagType: SegmentTagType): SegmentTag | null {
  const tags = (seg.tags ?? []) as SegmentTag[];
  return tags.find((tag) => tag.tag_key === tagKey && tag.tag_type === tagType) ?? null;
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

function identitySegmentTags(seg: MediaAssetSegment): SegmentTag[] {
  return visibleSegmentTags(seg).filter((tag) => tag.tag_type === 'identity');
}

function confirmedSegmentTags(seg: MediaAssetSegment): SegmentTag[] {
  return visibleSegmentTags(seg).filter((tag) => tag.tag_type !== 'identity');
}

function pendingSuggestionsForSegment(segId: string): SegmentTagSuggestion[] {
  const list = props.tagSuggestions?.[String(segId)] ?? [];
  return list.filter((suggestion) => suggestion.status === 'pending');
}

function canRemoveTag(tag: SegmentTag): boolean {
  if (props.canTagSegments && props.canModerateNarrations) return true;
  if (tag.tag_type !== 'identity') return false;
  if (!props.canTagSegments && !props.canTagPlayers) return false;
  const userId = props.currentUserId ?? null;
  if (!userId) return false;
  const profileId = tag.tagged_profile_id ?? tag.created_by;
  return String(profileId) === String(userId);
}

function addQuickTag(seg: MediaAssetSegment, tagKey: string, tagType: SegmentTagType) {
  if (!canAddQuickTags.value) return;
  if (segmentHasTag(seg, tagKey, tagType)) return;
  emit('addTag', { segmentId: String(seg.id), tagKey, tagType });
}

function handleQuickTagClick(seg: MediaAssetSegment, tagKey: string, tagType: SegmentTagType) {
  const existingTag = segmentTagFor(seg, tagKey, tagType);
  if (existingTag) {
    if (!canRemoveTag(existingTag)) return;
    removeTag(seg, existingTag);
    return;
  }
  addQuickTag(seg, tagKey, tagType);
}

function classForQuickTag(seg: MediaAssetSegment, tagKey: string, tagType: SegmentTagType): string {
  const existingTag = segmentTagFor(seg, tagKey, tagType);
  if (existingTag) {
    return canRemoveTag(existingTag)
      ? 'bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
      : 'bg-slate-700 text-slate-400 cursor-not-allowed';
  }
  return 'bg-slate-700/50 text-slate-300 hover:bg-slate-700';
}

function removeTag(seg: MediaAssetSegment, tag: SegmentTag) {
  if (!canRemoveTag(tag)) return;
  emit('removeTag', { segmentId: String(seg.id), tagId: String(tag.id) });
}

const autoTaggingSegmentSet = computed(() => {
  return new Set((props.autoTaggingSegmentIds ?? []).map((id) => String(id)));
});

function isAutoTagging(segmentId: string): boolean {
  return autoTaggingSegmentSet.value.has(String(segmentId));
}

const insightGeneratingSegmentSet = computed(() => {
  return new Set((props.insightGeneratingSegmentIds ?? []).map((id) => String(id)));
});

function isGeneratingInsight(segmentId: string): boolean {
  return insightGeneratingSegmentSet.value.has(String(segmentId));
}

function displayMemberName(member: OrgMember | null): string {
  if (!member) return '';
  return member.profile.name || member.profile.username || '';
}

const sortedMembers = computed(() => {
  return [...members.value].sort((a, b) => {
    const an = displayMemberName(a).toLowerCase();
    const bn = displayMemberName(b).toLowerCase();
    return an.localeCompare(bn);
  });
});

const filteredMembers = computed(() => {
  if (!memberQuery.value) return sortedMembers.value;
  const query = memberQuery.value.toLowerCase();
  return sortedMembers.value.filter((member) => displayMemberName(member).toLowerCase().includes(query));
});

const tagModalSegment = computed<MediaAssetSegment | null>(() => {
  if (!tagModalSegmentId.value) return null;
  const id = String(tagModalSegmentId.value);
  return (props.segments ?? []).find((seg) => String(seg.id) === id) ?? null;
});

const tagModalSegmentLabel = computed(() => {
  if (!tagModalSegment.value) return '';
  return formatSegmentStartTime(tagModalSegment.value);
});

const tagModalHeadline = computed(() => {
  if (!tagModalSegment.value) return '';
  return insightHeadlineForSegment(String(tagModalSegment.value.id)) ?? '';
});

function openTagModal(seg: MediaAssetSegment) {
  tagModalSegmentId.value = String(seg.id);
  tagModalError.value = null;
  showTagModal.value = true;
}

function closeTagModal() {
  showTagModal.value = false;
  tagModalSegmentId.value = null;
  selectedMember.value = null;
  memberQuery.value = '';
  tagModalError.value = null;
}

function confirmTagPlayer() {
  if (!tagModalSegment.value) {
    closeTagModal();
    return;
  }
  if (!selectedMember.value) {
    tagModalError.value = 'Please select a player.';
    return;
  }
  const tagKey = displayMemberName(selectedMember.value).trim();
  if (!tagKey) {
    tagModalError.value = 'Selected player has no name.';
    return;
  }
  if (segmentHasTag(tagModalSegment.value, tagKey, 'identity')) {
    tagModalError.value = 'Player already tagged.';
    return;
  }
  emit('addTag', {
    segmentId: String(tagModalSegment.value.id),
    tagKey,
    tagType: 'identity',
    taggedProfileId: String(selectedMember.value.profile.id),
  });
  tagModalError.value = null;
  selectedMember.value = null;
  memberQuery.value = '';
}

function isSavedNarration(n: NarrationListItem): n is NarrationWithAuthor {
  return !(n as any)?.status;
}

function isStaffRole(role: OrgRole | null | undefined): boolean {
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

// Segment deletion handlers
function getNarrationCount(segmentId: string): number {
  return allNarrationsForSegment(segmentId).length;
}

function canDeleteSegment(): boolean {
  return isStaffRole(props.currentUserRole);
}

function requestDeleteSegment(seg: MediaAssetSegment) {
  segmentToDelete.value = seg;
  showSegmentDeleteConfirm.value = true;
}

function closeSegmentDeleteConfirm(force = false) {
  if (isDeletingSegment.value && !force) return;
  showSegmentDeleteConfirm.value = false;
  segmentToDelete.value = null;
}

async function confirmDeleteSegment() {
  if (!segmentToDelete.value) return;
  isDeletingSegment.value = true;
  try {
    emit('deleteSegment', String(segmentToDelete.value.id));
    closeSegmentDeleteConfirm(true);
  } finally {
    isDeletingSegment.value = false;
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

async function loadMembers() {
  const orgId = activeOrgId.value;
  if (!orgId || !props.canTagPlayers) {
    members.value = [];
    membersError.value = null;
    membersLoading.value = false;
    return;
  }
  membersLoading.value = true;
  membersError.value = null;
  try {
    members.value = await orgService.listMembers(orgId);
  } catch (err) {
    membersError.value = err instanceof Error ? err.message : 'Failed to load players.';
  } finally {
    membersLoading.value = false;
  }
}

watch(
  () => [activeOrgId.value, props.canTagPlayers],
  () => {
    void loadMembers();
  },
  { immediate: true }
);

watch(selectedMember, () => {
  if (tagModalError.value) {
    tagModalError.value = null;
  }
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
const isApplyingExternalScroll = ref(false);

function applyExternalScrollTop(nextTop: number | undefined) {
  if (!listScrollEl.value || nextTop === undefined || !Number.isFinite(nextTop)) return;
  const clamped = Math.max(0, nextTop);
  if (Math.abs(listScrollEl.value.scrollTop - clamped) < 1) return;
  isApplyingExternalScroll.value = true;
  listScrollEl.value.scrollTop = clamped;
  requestAnimationFrame(() => {
    isApplyingExternalScroll.value = false;
  });
}

function handleListScroll() {
  if (!listScrollEl.value || isApplyingExternalScroll.value) return;
  emit('update:scrollTop', listScrollEl.value.scrollTop);
}

function animateSegmentCards() {
  if (!listScrollEl.value) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cards = Array.from(listScrollEl.value.querySelectorAll<HTMLElement>('[data-segment-card]'));
  cards.forEach((card, index) => {
    if (card.dataset.motionDone === 'true') return;
    card.dataset.motionDone = 'true';
    animateMini(
      card,
      {
        opacity: [0, 1],
        transform: ['translateY(8px)', 'translateY(0px)'],
      },
      { duration: 0.24, delay: Math.min(index * 0.03, 0.18), ease: 'easeOut' }
    );
  });
}

onMounted(() => {
  void nextTick(() => {
    applyExternalScrollTop(props.scrollTop);
    animateSegmentCards();
  });
});

watch(
  () => props.scrollTop,
  (nextTop) => {
    applyExternalScrollTop(nextTop);
  }
);

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

watch(
  () => [props.focusedSegmentId, props.activeSegmentId],
  () => {
    // Intentionally no auto-scroll on selection to avoid disorienting jumps.
  }
);

// Watch activeSegmentId to apply accordion behavior when timeline changes
watch(
  () => props.activeSegmentId,
  (newActiveId) => {
    if (!newActiveId) return;
    const id = String(newActiveId);
    if (expandedSegmentIds.value.has(id)) return;
    expandedSegmentIds.value = new Set([id]);
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
  if (!isSegmentExpanded(String(segId))) return [];
  return list;
}

function insightHeadlineForSegment(segId: string): string | null {
  const insight = insightForSegment(segId);
  const headline = String(insight?.insight_headline ?? '').trim();
  return headline || null;
}

function insightSentenceForSegment(segId: string): string | null {
  const insight = insightForSegment(segId);
  const sentence = String(insight?.insight_sentence ?? '').trim();
  return sentence || null;
}

function fallbackNarrationText(segId: string): string | null {
  const list = narrationsForSegment(segId);
  if (list.length === 0) return null;
  const first = list[0] as any;
  const text = String(first?.transcript_raw ?? '').trim();
  return text || null;
}

function narrationPreviewForSegment(segId: string): string | null {
  const text = fallbackNarrationText(segId);
  if (!text) return null;
  const limit = 35;
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}...`;
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

watch(
  () => orderedSegments.value.map((seg) => String(seg.id)),
  () => {
    void nextTick(() => animateSegmentCards());
  }
);

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

function formatSegmentStartTime(seg: MediaAssetSegment): string {
  return formatMinutesSeconds(seg.start_seconds ?? 0);
}

</script>

<template>
  <div
    ref="listScrollEl"
    class="narration-hover-scrollbar space-y-6 min-h-0 max-h-full overflow-y-auto overscroll-contain"
    @scroll.passive="handleListScroll"
  >
    <div
      :class="[
        'sticky top-0 z-20 space-y-6 border-b border-white/10 bg-black/10 pb-3 pt-4 backdrop-blur-sm supports-[backdrop-filter]:bg-black/10',
        props.showCloseButton ? 'px-4' : 'pl-4 pr-0',
      ]"
    >
      <!-- Header -->
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="text-lg font-semibold text-slate-50">Narrations</div>
            <div class="text-sm font-medium text-slate-300">{{ visibleNarrationCount }}</div>
          </div>
          <button
            v-if="props.showCloseButton"
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/90 ring-1 ring-white/10 hover:bg-black/70"
            aria-label="Close narrations panel"
            title="Close narrations panel"
            @click="emit('closePanel')"
          >
            <Icon icon="carbon:close" width="16" height="16" />
          </button>
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
    </div>

    <div :class="props.showCloseButton ? 'px-4' : 'pl-4 pr-0'">
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
          data-segment-card
          class="rounded-lg overflow-visible border transition-colors bg-slate-800/30"
          :class="Boolean(activeSegmentId && String(seg.id) === activeSegmentId) ? 'border-blue-400/80' : 'border-transparent'"
        >
          <!-- Segment Header -->
          <div class="px-4 py-2">
            <div class="flex items-center justify-between gap-2">
              <div
                role="button"
                tabindex="0"
                class="flex items-center min-w-0 flex-1 cursor-pointer group text-left"
                @click="handleSegmentHeaderClick(seg)"
                @keydown.enter.prevent="handleSegmentHeaderClick(seg)"
                @keydown.space.prevent="handleSegmentHeaderClick(seg)"
              >
                <div class="min-w-0">
                  <div v-if="isGeneratingInsight(String(seg.id))" class="flex items-center gap-2 text-sm text-slate-200">
                    <LoadingDot />
                    <ShimmerText text="Summarizing..." />
                  </div>
                  <div
                    v-else-if="insightHeadlineForSegment(seg.id) || narrationPreviewForSegment(seg.id)"
                    class="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-200"
                  >
                    <span>
                      {{ insightHeadlineForSegment(seg.id) || narrationPreviewForSegment(seg.id) }}
                    </span>
                    <button
                      v-if="props.canEditSegmentTiming"
                      type="button"
                      class="group/timer inline-flex items-center"
                      @click.stop="isTimingEditorOpen(String(seg.id)) ? closeTimingEditor() : openTimingEditor(seg)"
                    >
                      <span
                        class="inline-flex min-w-[3.5rem] justify-center rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-300 transition group-hover/timer:hidden group-focus-visible/timer:hidden"
                      >
                        {{ formatSegmentStartTime(seg) }}
                      </span>
                      <span
                        class="hidden min-w-[3.5rem] items-center justify-center gap-1 rounded-full bg-amber-300 px-2 py-0.5 text-xs font-semibold text-black transition group-hover/timer:inline-flex group-focus-visible/timer:inline-flex"
                      >
                        <Icon icon="carbon:timer" width="16" height="16" />
                      </span>
                    </button>
                    <span
                      v-else
                      class="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-300"
                    >
                      {{ formatSegmentStartTime(seg) }}
                    </span>
                    <button
                      v-if="props.canGenerateSegmentInsights && !insightSentenceForSegment(seg.id)"
                      type="button"
                      class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition disabled:opacity-50"
                      @click.stop="emit('generateSegmentInsight', { segmentId: String(seg.id) })"
                    >
                      <Icon icon="carbon:ai-generate" width="12" height="12" />
                      Summarize
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-0 shrink-0">
                <button
                  v-if="canOpenTagModal"
                  type="button"
                  class="inline-flex items-center justify-center rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition"
                  @click.stop="openTagModal(seg)"
                >
                  <Icon icon="carbon:tag" class="h-5 w-5" />
                </button>

                <SegmentActionsMenu
                  :can-delete="canDeleteSegment()"
                  :can-add-to-playlist="props.canAssignSegments"
                  :narration-count="getNarrationCount(String(seg.id))"
                  @add-narration="emit('addNarration', seg)"
                  @assign="props.canAssignSegments && emit('assignSegment', seg)"
                  @add-to-playlist="props.canAssignSegments && emit('addToPlaylist', seg)"
                  @delete="requestDeleteSegment(seg)"
                />
              </div>
            </div>

            <div
              v-if="props.canEditSegmentTiming && isTimingEditorOpen(String(seg.id))"
              class="mt-4 flex items-center gap-2"
              @click.stop
              @mousedown.stop
              @pointerdown.stop
            >
              <div class="min-w-0 flex-1">
                <div class="relative pt-5 pb-3">
                  <div class="h-[3px] w-full rounded-full bg-white/25" />
                  <div
                    class="pointer-events-none absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/85"
                    :style="{
                      left: `${timingSelectionLeftPercent()}%`,
                      right: `${timingSelectionRightPercent()}%`,
                    }"
                  />
                  <div
                    class="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-[150%] select-none rounded-full bg-white/95 px-2 py-[1px] text-[10px] font-semibold text-black tabular-nums"
                    :style="{ left: `${timingSelectionLeftPercent()}%` }"
                  >
                    {{ formatMinutesSeconds(timingStartSeconds) }}
                  </div>
                  <div
                    class="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-[150%] select-none rounded-full bg-white/95 px-2 py-[1px] text-[10px] font-semibold text-black tabular-nums"
                    :style="{ left: `${timingSelectionEndPercent()}%` }"
                  >
                    {{ formatMinutesSeconds(timingEndSeconds) }}
                  </div>
                  <div
                    class="timing-dual-slider"
                    @click.stop
                    @mousedown.stop
                    @pointerdown.stop
                  >
                    <input
                      class="timing-handle timing-handle--start"
                      type="range"
                      :min="timingWindowStartSeconds"
                      :max="timingWindowEndSeconds"
                      step="0.1"
                      :value="timingStartSeconds"
                      @input="onStartSliderInput(($event.target as HTMLInputElement).value)"
                    />
                    <input
                      class="timing-handle timing-handle--end"
                      type="range"
                      :min="timingWindowStartSeconds"
                      :max="timingWindowEndSeconds"
                      step="0.1"
                      :value="timingEndSeconds"
                      @input="onEndSliderInput(($event.target as HTMLInputElement).value)"
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                class="ml-auto inline-flex items-center justify-center rounded-full p-1 text-white/70 hover:text-white"
                @click.stop="applyTimingUpdate(seg)"
              >
                <Icon icon="carbon:checkmark" width="14" height="14" />
              </button>
            </div>

            <div
              v-if="confirmedSegmentTags(seg).length || identitySegmentTags(seg).length"
              class="mt-2 space-y-2"
            >
              <div v-if="confirmedSegmentTags(seg).length" class="space-y-1">
                <div class="text-[10px] uppercase tracking-wide text-slate-500">Confirmed tags</div>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="tag in confirmedSegmentTags(seg)"
                    :key="String(tag.id)"
                    class="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
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
              </div>
              <div v-if="identitySegmentTags(seg).length" class="space-y-1">
                <div class="text-[10px] uppercase tracking-wide text-slate-500">Players involved</div>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="tag in identitySegmentTags(seg)"
                    :key="String(tag.id)"
                    class="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
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
              </div>
            </div>
          </div>

        <div
          v-if="isSegmentExpanded(String(seg.id)) && insightSentenceForSegment(seg.id)"
          class="px-4 text-xs text-slate-400"
        >
          {{ insightSentenceForSegment(seg.id) }}
        </div>

        <!-- Narrations -->
        <div v-if="narrationsForSegment(String(seg.id)).length > 0 && isSegmentExpanded(String(seg.id))" class="divide-y divide-slate-700/50">
          <NarrationRow
            v-for="n in visibleNarrationsForSegment(String(seg.id))"
            :key="String((n as any).id)"
            :narration="n"
            :is-active="Boolean(activeSegmentId && String(seg.id) === activeSegmentId)"
            :is-editing="isSavedNarration(n) && editingNarrationId === String(n.id)"
            :edit-text="editingText"
            :can-edit="canEditNarration(n)"
            :can-delete="canDeleteNarration(n)"
            @click="handleNarrationClick(seg)"
            @edit="startEditing(n as any)"
            @delete="requestDelete(n as any)"
            @cancel-edit="cancelEditing"
            @save-edit="(text) => { editingText = text; saveEditing(n as any); }"
            @update:edit-text="(text) => editingText = text"
          />

        </div>

      </div>
    </div>
  </div>
</div>

  <!-- Tagging Modal -->
  <TransitionRoot :show="showTagModal">
    <Dialog @close="closeTagModal" class="relative z-70">
      <TransitionChild
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            enter="ease-out duration-300"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-3xl text-white my-8">
              <header class="p-4 border-b border-b-white/20 space-y-1">
                <DialogTitle as="h2" class="flex flex-wrap items-center gap-2 text-base font-semibold">
                  <span>{{ tagModalHeadline || 'Segment tags' }}</span>
                  <span v-if="tagModalSegmentLabel" class="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-semibold text-blue-300">
                    {{ tagModalSegmentLabel }}
                  </span>
                </DialogTitle>
                <p class="text-sm text-gray-400">Review and edit tags for this segment.</p>
              </header>

              <div v-if="tagModalSegment" class="p-4 space-y-5">
                <section class="space-y-2">
                  <div class="text-xs uppercase tracking-wide text-slate-400">Confirmed tags</div>
                  <div v-if="confirmedSegmentTags(tagModalSegment).length" class="flex flex-wrap gap-2">
                    <button
                      v-for="tag in confirmedSegmentTags(tagModalSegment)"
                      :key="String(tag.id)"
                      type="button"
                      class="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide ring-1 ring-transparent transition"
                      :class="[
                        classForTag(tag),
                        canRemoveTag(tag)
                          ? 'hover:bg-rose-500/20 hover:text-rose-200 hover:ring-rose-300/30'
                          : 'cursor-default'
                      ]"
                      @click="canRemoveTag(tag) && removeTag(tagModalSegment, tag)"
                    >
                      <span>{{ formatTagLabel(tag.tag_key) }}</span>
                      <Icon v-if="canRemoveTag(tag)" icon="carbon:close" width="10" height="10" />
                    </button>
                  </div>
                  <div v-else class="text-xs text-slate-500">No confirmed tags yet.</div>
                </section>

                <section class="space-y-3">
                  <div class="text-xs uppercase tracking-wide text-slate-400">Players</div>
                  <div v-if="identitySegmentTags(tagModalSegment).length" class="flex flex-wrap gap-2">
                    <button
                      v-for="tag in identitySegmentTags(tagModalSegment)"
                      :key="String(tag.id)"
                      type="button"
                      class="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide ring-1 ring-transparent transition"
                      :class="[
                        classForTag(tag),
                        canRemoveTag(tag)
                          ? 'hover:bg-rose-500/20 hover:text-rose-200 hover:ring-rose-300/30'
                          : 'cursor-default'
                      ]"
                      @click="canRemoveTag(tag) && removeTag(tagModalSegment, tag)"
                    >
                      <span>{{ formatTagLabel(tag.tag_key) }}</span>
                      <Icon v-if="canRemoveTag(tag)" icon="carbon:close" width="10" height="10" />
                    </button>
                  </div>
                  <div v-else class="text-xs text-slate-500">No players tagged yet.</div>

                  <div v-if="props.canTagPlayers" class="space-y-2">
                    <label class="text-xs text-slate-400">Tag a player</label>
                    <Combobox v-model="selectedMember" nullable :disabled="membersLoading">
                      <div class="relative">
                        <div class="relative">
                          <ComboboxInput
                            class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1.5 pr-10 focus:border-white outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            :display-value="(member: any) => displayMemberName(member)"
                            :placeholder="membersLoading ? 'Loading players...' : 'Search players...'"
                            @change="memberQuery = $event.target.value"
                          />
                          <ComboboxButton class="absolute inset-y-0 right-0 flex items-center pr-2">
                            <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
                          </ComboboxButton>
                        </div>
                        <TransitionRoot
                          leave="transition ease-in duration-100"
                          leave-from="opacity-100"
                          leave-to="opacity-0"
                          @after-leave="memberQuery = ''"
                        >
                          <ComboboxOptions
                            class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 text-sm shadow-lg focus:outline-none"
                          >
                            <div v-if="filteredMembers.length === 0 && memberQuery !== ''" class="px-3 py-2 text-white/50">
                              No players found.
                            </div>
                            <div v-else-if="filteredMembers.length === 0 && !memberQuery && !membersLoading" class="px-3 py-2 text-white/50">
                              No players available.
                            </div>
                            <ComboboxOption
                              v-for="member in filteredMembers"
                              :key="member.profile.id"
                              :value="member"
                              as="template"
                              v-slot="{ active, selected }"
                            >
                              <li
                                class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                                :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                              >
                                <div class="flex flex-col">
                                  <span :class="selected ? 'font-semibold' : 'font-normal'" class="block truncate">
                                    {{ displayMemberName(member) }}
                                  </span>
                                  <span v-if="member.profile.username && member.profile.name" class="text-xs text-white/40">
                                    @{{ member.profile.username }}
                                  </span>
                                </div>
                                <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                                  <Icon icon="carbon:checkmark" class="h-4 w-4" />
                                </span>
                              </li>
                            </ComboboxOption>
                          </ComboboxOptions>
                        </TransitionRoot>
                      </div>
                    </Combobox>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="rounded border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        :disabled="membersLoading || !selectedMember"
                        @click="confirmTagPlayer"
                      >
                        Add player
                      </button>
                    </div>
                  </div>

                  <div v-if="membersError" class="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {{ membersError }}
                  </div>

                  <div v-if="tagModalError" class="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {{ tagModalError }}
                  </div>
                </section>

                <section class="space-y-2">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-400">
                      <Icon icon="carbon:ai-generate" width="14" height="14" class="text-emerald-200" />
                      Suggested by AI
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        v-if="props.canAutoTagSegments"
                        type="button"
                        class="rounded border border-emerald-400/30 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-400/10 transition disabled:opacity-50"
                        :disabled="isAutoTagging(String(tagModalSegment.id))"
                        @click="emit('autoTagSegment', tagModalSegment)"
                      >
                        <span class="inline-flex items-center gap-1.5">
                          <Icon icon="carbon:ai-generate" width="14" height="14" />
                          {{ isAutoTagging(String(tagModalSegment.id)) ? 'Auto-tagging…' : 'Auto-tag' }}
                        </span>
                      </button>
                      <button
                        v-if="props.canAutoTagSegments && pendingSuggestionsForSegment(tagModalSegment.id).length"
                        type="button"
                        class="rounded border border-emerald-400/30 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-400/10 transition"
                        @click="emit('applySuggestedTags', { segmentId: String(tagModalSegment.id), applyAll: true })"
                      >
                        Apply all
                      </button>
                    </div>
                  </div>
                  <div v-if="pendingSuggestionsForSegment(tagModalSegment.id).length" class="flex flex-wrap gap-2">
                    <div
                      v-for="suggestion in pendingSuggestionsForSegment(tagModalSegment.id)"
                      :key="suggestion.id"
                      class="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide bg-emerald-500/15 text-emerald-200"
                    >
                      <span>{{ formatTagLabel(suggestion.tag_key) }}</span>
                      <button
                        v-if="props.canAutoTagSegments"
                        type="button"
                        class="text-emerald-200/70 hover:text-emerald-100"
                        @click="emit('rejectSuggestedTag', { segmentId: String(tagModalSegment.id), suggestionId: suggestion.id })"
                      >
                        <Icon icon="carbon:close" width="10" height="10" />
                      </button>
                    </div>
                  </div>
                  <div v-else class="text-xs text-slate-500">No AI suggestions yet.</div>
                </section>

                <section v-if="canAddQuickTags" class="space-y-3">
                  <div class="text-xs uppercase tracking-wide text-slate-400">Quick add</div>
                  <div>
                    <div class="text-xs uppercase tracking-wide text-slate-400 mb-2">Set Piece / Restarts</div>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="tagKey in SET_PIECE_TAGS"
                        :key="tagKey"
                        type="button"
                        class="rounded px-2.5 py-1 text-xs uppercase tracking-wide transition"
                        :class="classForQuickTag(tagModalSegment, tagKey, 'context')"
                        @click="handleQuickTagClick(tagModalSegment, tagKey, 'context')"
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
                        :class="classForQuickTag(tagModalSegment, tagKey, 'action')"
                        @click="handleQuickTagClick(tagModalSegment, tagKey, 'action')"
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
                        :class="classForQuickTag(tagModalSegment, tagKey, 'context')"
                        @click="handleQuickTagClick(tagModalSegment, tagKey, 'context')"
                      >
                        {{ formatTagLabel(tagKey) }}
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              <div v-else class="p-4 text-sm text-slate-400">No segment selected.</div>

              <footer class="p-4 border-t border-white/20 flex items-center justify-end">
                <button
                  type="button"
                  class="rounded border border-white/20 px-3 py-1.5 text-sm text-white/70 hover:text-white hover:border-white/40 transition"
                  @click="closeTagModal"
                >
                  Close
                </button>
              </footer>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>

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

  <!-- Segment Delete Confirmation Modal -->
  <ConfirmDeleteModal
    :show="showSegmentDeleteConfirm"
    :item-name="`this segment${segmentToDelete && getNarrationCount(String(segmentToDelete.id)) > 0 ? ` and ${getNarrationCount(String(segmentToDelete.id))} narration${getNarrationCount(String(segmentToDelete.id)) > 1 ? 's' : ''}` : ''}`"
    popup-title="Delete Segment"
    :is-deleting="isDeletingSegment"
    @confirm="confirmDeleteSegment"
    @cancel="closeSegmentDeleteConfirm"
    @close="closeSegmentDeleteConfirm"
  />
</template>

<style scoped>
.timing-dual-slider {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}

.timing-handle {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  background: transparent;
  pointer-events: none;
  -webkit-appearance: none;
  appearance: none;
}

.timing-handle::-webkit-slider-runnable-track {
  height: 3px;
  background: transparent;
  border: 0;
}

.timing-handle::-moz-range-track {
  height: 3px;
  background: transparent;
  border: 0;
}

.timing-handle::-webkit-slider-thumb {
  pointer-events: auto;
  width: 0.6rem;
  height: 0.6rem;
  margin-top: calc((3px - 0.6rem) / 2);
  border-radius: 9999px;
  border: 0;
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.25);
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.timing-handle::-moz-range-thumb {
  pointer-events: auto;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 9999px;
  border: 0;
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.25);
  cursor: pointer;
}

.timing-handle--start {
  z-index: 2;
}

.timing-handle--end {
  z-index: 3;
}

.narration-hover-scrollbar::after {
  content: '';
  display: block;
  height: 9rem;
  pointer-events: none;
}
</style>

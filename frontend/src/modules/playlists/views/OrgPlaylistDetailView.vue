<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { storeToRefs } from 'pinia';
import { useSortable } from '@vueuse/integrations/useSortable';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { playlistService } from '@/modules/playlists/services/playlistService';
import type { Playlist, PlaylistSegment, PlaylistTag, PlaylistFeedEntry } from '@/modules/playlists/types';
import { toast } from '@/lib/toast';
import LoadingDot from '@/components/LoadingDot.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import { formatMinutesSeconds } from '@/lib/duration';
import { CDN_BASE } from '@/lib/cdn';

const route = useRoute();
const router = useRouter();
const activeOrgStore = useActiveOrganizationStore();
const { orgContextReadonly } = storeToRefs(activeOrgStore);

const loading = ref(false);
const playlist = ref<Playlist | null>(null);
const feedEntries = ref<PlaylistFeedEntry[]>([]);
const originalOrder = ref<PlaylistFeedEntry[]>([]);
const tags = ref<PlaylistTag[]>([]);
const sortableContainer = ref<HTMLElement | null>(null);
const hasUnsavedChanges = ref(false);
const isSaving = ref(false);

const showEditModal = ref(false);
const editName = ref('');
const editDescription = ref('');
const isUpdating = ref(false);

const showDeleteSegmentModal = ref(false);
const segmentToRemove = ref<PlaylistFeedEntry | null>(null);
const isRemoving = ref(false);

const showDeletePlaylistModal = ref(false);
const isDeleting = ref(false);

const orgSlug = computed(() => orgContextReadonly.value?.organization?.slug ?? '');
const orgId = computed(() => orgContextReadonly.value?.organization?.id ?? '');
const playlistId = computed(() => String(route.params.playlistId ?? ''));

async function load() {
  if (!playlistId.value || !orgId.value) return;
  
  loading.value = true;
  try {
    const [playlistData, feedData, tagsData] = await Promise.all([
      playlistService.getPlaylist(playlistId.value),
      playlistService.getPlaylistFeed(playlistId.value, orgId.value),
      playlistService.getPlaylistTags(playlistId.value),
    ]);
    
    playlist.value = playlistData;
    feedEntries.value = feedData;
    originalOrder.value = JSON.parse(JSON.stringify(feedData)); // Deep copy
    hasUnsavedChanges.value = false;
    tags.value = tagsData;
    
    // Debug: Log loaded order
    console.log('Loaded playlist order:');
    feedData.forEach((entry, idx) => {
      console.log(`  [${idx}] sort_order: ${entry.sort_order}, time: ${entry.start_seconds} - ${entry.end_seconds}`);
    });
  } catch (err) {
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to load playlist',
      durationMs: 3000,
    });
    router.back();
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.push({ name: 'OrgPlaylists', params: { slug: orgSlug.value } });
}

function getThumbnailUrl(entry: PlaylistFeedEntry): string | null {
  if (!entry.media_asset_thumbnail_path) return null;
  return `${CDN_BASE}/${entry.media_asset_thumbnail_path}`;
}

function playPlaylist() {
  if (!feedEntries.value.length) {
    toast({ variant: 'error', message: 'No segments in playlist', durationMs: 2000 });
    return;
  }
  
  router.push({
    name: 'OrgFeedView',
    params: { slug: orgSlug.value },
    query: {
      source: 'playlist',
      playlistId: playlistId.value,
    },
  });
}

function openEditModal() {
  if (!playlist.value) return;
  editName.value = playlist.value.name;
  editDescription.value = playlist.value.description || '';
  showEditModal.value = true;
}

function closeEditModal() {
  showEditModal.value = false;
}

async function updatePlaylist() {
  const trimmedName = editName.value.trim();
  if (!trimmedName) {
    toast({ variant: 'error', message: 'Please enter a playlist name', durationMs: 2000 });
    return;
  }
  
  if (!playlistId.value) return;
  
  isUpdating.value = true;
  try {
    const updated = await playlistService.updatePlaylist(playlistId.value, {
      name: trimmedName,
      description: editDescription.value.trim() || null,
    });
    
    playlist.value = updated;
    toast({
      variant: 'success',
      message: 'Playlist updated',
      durationMs: 2000,
    });
    closeEditModal();
  } catch (err) {
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to update playlist',
      durationMs: 3000,
    });
  } finally {
    isUpdating.value = false;
  }
}

function requestRemoveSegment(entry: PlaylistFeedEntry) {
  segmentToRemove.value = entry;
  showDeleteSegmentModal.value = true;
}

async function confirmRemoveSegment() {
  if (!segmentToRemove.value || !playlistId.value) return;
  
  const entry = segmentToRemove.value;
  isRemoving.value = true;
  
  try {
    await playlistService.removeSegmentFromPlaylist(playlistId.value, entry.segment_id);
    toast({
      variant: 'success',
      message: 'Segment removed from playlist',
      durationMs: 2000,
    });
    showDeleteSegmentModal.value = false;
    segmentToRemove.value = null;
    await load();
  } catch (err) {
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to remove segment',
      durationMs: 3000,
    });
  } finally {
    isRemoving.value = false;
  }
}

async function handleReorder() {
  // Just mark as changed, don't save yet
  hasUnsavedChanges.value = true;
}

async function saveOrder() {
  if (!playlistId.value || feedEntries.value.length === 0) return;
  
  isSaving.value = true;
  try {
    const segmentIds = feedEntries.value.map(entry => entry.segment_id);
    
    // Debug: Log what we're about to save
    console.log('Current feedEntries order:');
    feedEntries.value.forEach((entry, idx) => {
      console.log(`  [${idx}] ${entry.start_seconds} - ${entry.end_seconds}`);
    });
    console.log('Saving segment IDs:', segmentIds);
    
    await playlistService.reorderPlaylistSegments(playlistId.value, segmentIds);
    
    // Update original order and clear unsaved flag
    originalOrder.value = JSON.parse(JSON.stringify(feedEntries.value));
    hasUnsavedChanges.value = false;
    
    toast({
      variant: 'success',
      message: 'Playlist order saved',
      durationMs: 2000,
    });
  } catch (err) {
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to save order',
      durationMs: 3000,
    });
  } finally {
    isSaving.value = false;
  }
}

function cancelReorder() {
  feedEntries.value = JSON.parse(JSON.stringify(originalOrder.value));
  hasUnsavedChanges.value = false;
}

function requestDeletePlaylist() {
  showDeletePlaylistModal.value = true;
}

async function confirmDeletePlaylist() {
  if (!playlistId.value) return;
  
  isDeleting.value = true;
  try {
    await playlistService.deletePlaylist(playlistId.value);
    toast({
      variant: 'success',
      message: 'Playlist deleted',
      durationMs: 2000,
    });
    router.push({ name: 'OrgPlaylists', params: { slug: orgSlug.value } });
  } catch (err) {
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to delete playlist',
      durationMs: 3000,
    });
  } finally {
    isDeleting.value = false;
  }
}

function formatSegmentTime(entry: PlaylistFeedEntry): string {
  const start = formatMinutesSeconds(entry.start_seconds);
  const end = formatMinutesSeconds(entry.end_seconds);
  return `${start} – ${end}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

onMounted(() => {
  void load();
});

// Initialize sortable after feed entries are loaded
watch([sortableContainer, feedEntries], ([container, entries]) => {
  if (container && entries.length > 0) {
    useSortable(sortableContainer, feedEntries, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      onEnd: (evt) => {
        // Manually reorder the array to match the new DOM order
        const { oldIndex, newIndex } = evt;
        if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
          const movedItem = feedEntries.value[oldIndex];
          const newArray = [...feedEntries.value];
          newArray.splice(oldIndex, 1);
          newArray.splice(newIndex, 0, movedItem);
          feedEntries.value = newArray;
          
          console.log('Drag completed:', { oldIndex, newIndex, movedItem: `${movedItem.start_seconds} - ${movedItem.end_seconds}` });
          
          void handleReorder();
        }
      },
    });
  }
}, { immediate: true });
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <div class="container-lg mx-auto px-4 py-8">
      <!-- Back Button -->
      <button
        type="button"
        class="flex items-center gap-2 text-gray-400 hover:text-white transition mb-6"
        @click="goBack"
      >
        <Icon icon="carbon:arrow-left" width="20" height="20" />
        Back to Playlists
      </button>

      <!-- Loading State -->
      <div v-if="loading" class="animate-pulse space-y-6">
        <div class="h-8 bg-white/10 rounded w-1/3"></div>
        <div class="h-20 bg-white/10 rounded"></div>
        <div class="space-y-3">
          <div v-for="i in 3" :key="i" class="h-24 bg-white/10 rounded"></div>
        </div>
      </div>

      <!-- Content -->
      <div v-else-if="playlist" class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div class="flex-1 min-w-0">
            <h1 class="text-3xl font-bold mb-2 break-words">{{ playlist.name }}</h1>
            <p v-if="playlist.description" class="text-gray-400 mb-4">{{ playlist.description }}</p>
            
            <div class="flex flex-wrap items-center gap-4 text-sm text-gray-400">
              <div class="flex items-center gap-1.5">
                <Icon icon="carbon:video" width="16" height="16" />
                <span>{{ feedEntries.length }} segment{{ feedEntries.length !== 1 ? 's' : '' }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <Icon icon="carbon:calendar" width="16" height="16" />
                <span>Created {{ formatDate(playlist.created_at) }}</span>
              </div>
            </div>

            <!-- Tags -->
            <div v-if="tags.length > 0" class="flex items-center gap-2 mt-4">
              <Icon icon="carbon:tag" width="16" height="16" class="text-gray-400" />
              <div class="flex gap-2 flex-wrap">
                <span
                  v-for="tag in tags"
                  :key="tag.id"
                  class="px-2 py-1 bg-white/10 rounded text-sm"
                >
                  {{ tag.tag_key }}
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-2">
            <!-- Save/Cancel buttons (show when reordering) -->
            <template v-if="hasUnsavedChanges">
              <button
                type="button"
                class="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium"
                :disabled="isSaving"
                @click="saveOrder"
              >
                <Icon v-if="!isSaving" icon="carbon:checkmark" width="20" height="20" />
                <LoadingDot v-else />
                <span v-if="!isSaving">Save Order</span>
                <span v-else>Saving...</span>
              </button>
              <button
                type="button"
                class="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                :disabled="isSaving"
                @click="cancelReorder"
              >
                <Icon icon="carbon:close" width="20" height="20" />
                Cancel
              </button>
            </template>

            <!-- Normal actions -->
            <template v-else>
              <button
                v-if="feedEntries.length > 0"
                type="button"
                class="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-white/90 transition font-medium"
                @click="playPlaylist"
              >
                <Icon icon="carbon:play-filled" width="20" height="20" />
                Play Playlist
                </button>
              <button
                type="button"
                class="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                @click="openEditModal"
              >
                <Icon icon="carbon:edit" width="20" height="20" />
                Edit
              </button>
              <button
                type="button"
                class="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                @click="requestDeletePlaylist"
              >
                <Icon icon="carbon:trash-can" width="20" height="20" />
                Delete
              </button>
            </template>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="feedEntries.length === 0" class="text-center py-16 border border-white/10 rounded-lg">
          <Icon icon="carbon:video-off" width="64" height="64" class="mx-auto mb-4 text-gray-600" />
          <h3 class="text-xl font-semibold mb-2">No segments yet</h3>
          <p class="text-gray-400">Add segments to this playlist from the media review page</p>
        </div>

        <!-- Segments List -->
        <div v-else ref="sortableContainer" class="space-y-3">
          <div
            v-for="(entry, index) in feedEntries"
            :key="entry.playlist_segment_id"
            class="w-full flex flex-col sm:flex-row gap-0 sm:gap-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group relative"
          >
            <!-- Mobile: Thumbnail with position overlay -->
            <div class="relative sm:hidden w-full aspect-video bg-black overflow-hidden rounded-t-lg">
              <img
                v-if="entry.media_asset_thumbnail_path"
                :src="getThumbnailUrl(entry)"
                :alt="`Segment ${index + 1} thumbnail`"
                class="w-full h-full object-cover"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center text-white/20"
              >
                <Icon icon="carbon:video" width="40" />
              </div>
              
              <!-- Position badge (mobile) -->
              <div class="absolute top-2 left-2 z-20">
                <div class="w-8 h-8 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm text-white/90 text-sm font-medium">
                  {{ index + 1 }}
                </div>
              </div>

              <!-- Remove button (mobile) -->
              <div class="absolute top-2 right-2 z-20">
                <button
                  type="button"
                  class="rounded p-2 bg-black/60 backdrop-blur-sm text-red-400 hover:bg-black/80 transition touch-manipulation"
                  title="Remove from playlist"
                  @click.stop="requestRemoveSegment(entry)"
                >
                  <Icon icon="carbon:trash-can" class="h-5 w-5" />
                </button>
              </div>
            </div>

            <!-- Desktop: Thumbnail (left side) -->
            <div class="hidden sm:flex items-center gap-3 m-4">
              <!-- Drag Handle -->
              <div
                class="drag-handle flex-shrink-0 p-1 text-white/40 hover:text-white/70 cursor-grab active:cursor-grabbing transition"
                title="Drag to reorder"
              >
                <Icon icon="carbon:draggable" class="h-5 w-5" />
              </div>

              <!-- Position Number -->
              <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-sm font-medium">
                {{ index + 1 }}
              </div>

              <!-- Thumbnail -->
              <div class="w-32 h-20 flex-shrink-0 rounded overflow-hidden bg-black">
                <img
                  v-if="entry.media_asset_thumbnail_path"
                  :src="getThumbnailUrl(entry)"
                  :alt="`Segment ${index + 1} thumbnail`"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center text-white/20 text-xs"
                >
                  <Icon icon="carbon:video" width="24" />
                </div>
              </div>
            </div>

            <!-- Segment Info -->
            <div class="flex-1 min-w-0 flex flex-col justify-between p-3 sm:py-4 sm:pr-0 sm:pl-0">
              <!-- Title -->
              <div>
                <h3 class="text-sm sm:text-base font-semibold text-white group-hover:text-white/90 truncate mb-1">
                  {{ entry.media_asset_file_name }}
                </h3>
                
                <!-- Metadata -->
                <div class="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-white/50 flex-wrap">
                  <Icon icon="carbon:time" width="12" class="sm:w-3.5" />
                  <span>{{ formatSegmentTime(entry) }}</span>
                  <span class="text-white/30">•</span>
                  <span>Segment {{ entry.segment_index }}</span>
                </div>
              </div>
            </div>

            <!-- Desktop: Remove button (right side) -->
            <div class="hidden sm:flex flex-shrink-0 items-start pt-4 pr-4 z-20">
              <button
                type="button"
                class="p-2 rounded hover:bg-red-500/10 text-red-400 transition opacity-0 group-hover:opacity-100"
                title="Remove from playlist"
                @click="requestRemoveSegment(entry)"
              >
                <Icon icon="carbon:trash-can" class="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div class="bg-black border border-white/20 rounded-lg w-full max-w-lg">
        <div class="p-6 border-b border-white/20">
          <h2 class="text-xl font-semibold">Edit Playlist</h2>
        </div>

        <div class="p-6 space-y-4">
          <div>
            <label for="edit-name" class="block text-sm font-medium mb-2">Playlist Name</label>
            <input
              id="edit-name"
              v-model="editName"
              type="text"
              placeholder="Enter playlist name"
              class="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-white focus:outline-none"
              @keydown.enter="updatePlaylist"
            />
          </div>

          <div>
            <label for="edit-description" class="block text-sm font-medium mb-2">Description (optional)</label>
            <textarea
              id="edit-description"
              v-model="editDescription"
              placeholder="Enter description"
              rows="3"
              class="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-white focus:outline-none resize-none"
            ></textarea>
          </div>
        </div>

        <div class="p-6 border-t border-white/20 flex justify-end gap-3">
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
            :disabled="isUpdating"
            @click="closeEditModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-white text-black hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            :disabled="isUpdating || !editName.trim()"
            @click="updatePlaylist"
          >
            <span v-if="isUpdating" class="flex items-center gap-2">
              <Icon icon="carbon:circle-dash" class="animate-spin" width="16" height="16" />
              Saving...
            </span>
            <span v-else>Save Changes</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Remove Segment Confirmation Modal -->
    <ConfirmDeleteModal
      :show="showDeleteSegmentModal"
      :item-name="segmentToRemove?.media_asset_file_name || 'this segment'"
      popup-title="Remove segment from playlist?"
      :is-deleting="isRemoving"
      @confirm="confirmRemoveSegment"
      @cancel="showDeleteSegmentModal = false; segmentToRemove = null;"
    />

    <!-- Delete Playlist Confirmation Modal -->
    <ConfirmDeleteModal
      :show="showDeletePlaylistModal"
      :item-name="playlist?.name || 'this playlist'"
      popup-title="Delete playlist?"
      :is-deleting="isDeleting"
      @confirm="confirmDeletePlaylist"
      @cancel="showDeletePlaylistModal = false"
    />
  </div>
</template>

<style scoped>
/* Drag and drop styles */
.sortable-ghost {
  opacity: 0.4;
}

.sortable-drag {
  opacity: 0.8;
  transform: rotate(2deg);
}

.drag-handle:active {
  cursor: grabbing !important;
}
</style>

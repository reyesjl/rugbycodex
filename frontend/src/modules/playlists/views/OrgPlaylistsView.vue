<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { storeToRefs } from 'pinia';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { playlistService } from '@/modules/playlists/services/playlistService';
import type { PlaylistListItem } from '@/modules/playlists/types';
import { toast } from '@/lib/toast';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';

const route = useRoute();
const router = useRouter();
const activeOrgStore = useActiveOrganizationStore();
const { orgContextReadonly } = storeToRefs(activeOrgStore);

const loading = ref(false);
const playlists = ref<PlaylistListItem[]>([]);
const searchQuery = ref('');

const showCreateModal = ref(false);
const showDeleteModal = ref(false);
const playlistToDelete = ref<PlaylistListItem | null>(null);
const isDeleting = ref(false);

const newPlaylistName = ref('');
const newPlaylistDescription = ref('');
const isCreating = ref(false);

const orgSlug = computed(() => orgContextReadonly.value?.organization?.slug ?? '');
const orgId = computed(() => orgContextReadonly.value?.organization?.id ?? '');

const filteredPlaylists = computed(() => {
  if (!searchQuery.value.trim()) return playlists.value;
  
  const query = searchQuery.value.toLowerCase();
  return playlists.value.filter((p) => {
    const nameMatch = p.name.toLowerCase().includes(query);
    const descMatch = (p.description || '').toLowerCase().includes(query);
    const tagMatch = p.tags.some((t) => t.tag_key.toLowerCase().includes(query));
    return nameMatch || descMatch || tagMatch;
  });
});

async function loadPlaylists() {
  if (!orgId.value) return;
  
  loading.value = true;
  try {
    playlists.value = await playlistService.listPlaylistsForOrg(orgId.value);
  } catch (err) {
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to load playlists',
      durationMs: 3000,
    });
  } finally {
    loading.value = false;
  }
}

function openPlaylist(playlistId: string) {
  router.push({
    name: 'OrgPlaylistDetail',
    params: { slug: orgSlug.value, playlistId },
  });
}

function openCreateModal() {
  newPlaylistName.value = '';
  newPlaylistDescription.value = '';
  showCreateModal.value = true;
}

function closeCreateModal() {
  showCreateModal.value = false;
}

async function createPlaylist() {
  const trimmedName = newPlaylistName.value.trim();
  if (!trimmedName) {
    toast({ variant: 'error', message: 'Please enter a playlist name', durationMs: 2000 });
    return;
  }
  
  if (!orgId.value) return;
  
  isCreating.value = true;
  try {
    const created = await playlistService.createPlaylist({
      orgId: orgId.value,
      name: trimmedName,
      description: newPlaylistDescription.value.trim() || null,
    });
    
    toast({
      variant: 'success',
      message: `Playlist "${created.name}" created`,
      durationMs: 2500,
    });
    
    closeCreateModal();
    await loadPlaylists();
    
    // Navigate to the new playlist
    openPlaylist(created.id);
  } catch (err) {
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to create playlist',
      durationMs: 3000,
    });
  } finally {
    isCreating.value = false;
  }
}

function requestDelete(playlist: PlaylistListItem) {
  playlistToDelete.value = playlist;
  showDeleteModal.value = true;
}

async function confirmDelete() {
  if (!playlistToDelete.value) return;
  
  const playlist = playlistToDelete.value;
  isDeleting.value = true;
  
  try {
    await playlistService.deletePlaylist(playlist.id);
    toast({
      variant: 'success',
      message: `Playlist "${playlist.name}" deleted`,
      durationMs: 2500,
    });
    showDeleteModal.value = false;
    playlistToDelete.value = null;
    await loadPlaylists();
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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

onMounted(() => {
  void loadPlaylists();
});
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <div class="container-lg mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl mb-2">Playlists</h1>
      </div>

      <!-- Actions Bar -->
      <div class="flex flex-col md:flex-row gap-4 mb-6">
        <!-- Search -->
        <div class="flex-1">
          <div class="relative">
            <Icon
              icon="carbon:search"
              class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              width="18"
              height="18"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search playlists..."
              class="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-white focus:outline-none"
            />
          </div>
        </div>

        <!-- Create Button -->
        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-white/90 transition font-medium"
          @click="openCreateModal"
        >
          <Icon icon="carbon:add" width="20" height="20" />
          Create Playlist
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="bg-white/5 rounded-lg p-6 animate-pulse">
          <div class="h-6 bg-white/10 rounded w-1/3 mb-3"></div>
          <div class="h-4 bg-white/10 rounded w-2/3"></div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredPlaylists.length === 0 && !searchQuery" class="text-center py-16">
        <Icon icon="carbon:playlist" width="64" height="64" class="mx-auto mb-4 text-gray-600" />
        <h3 class="text-xl font-semibold mb-2">No playlists yet</h3>
        <p class="text-gray-400 mb-6">Create your first playlist to organize and share video segments</p>
        <button
          type="button"
          class="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg hover:bg-white/90 transition font-medium"
          @click="openCreateModal"
        >
          <Icon icon="carbon:add" width="20" height="20" />
          Create Playlist
        </button>
      </div>

      <!-- No Results -->
      <div v-else-if="filteredPlaylists.length === 0" class="text-center py-16">
        <Icon icon="carbon:search" width="64" height="64" class="mx-auto mb-4 text-gray-600" />
        <h3 class="text-xl font-semibold mb-2">No playlists found</h3>
        <p class="text-gray-400">Try adjusting your search query</p>
      </div>

      <!-- Playlists List -->
      <div v-else class="space-y-3">
        <button
          v-for="playlist in filteredPlaylists"
          :key="playlist.id"
          type="button"
          class="w-full bg-white/5 hover:bg-white/10 rounded-lg p-6 text-left transition group border border-transparent hover:border-white/20"
          @click="openPlaylist(playlist.id)"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <!-- Title -->
              <div class="flex items-center gap-2 mb-2">
                <Icon icon="carbon:playlist" width="20" height="20" class="text-gray-400 flex-shrink-0" />
                <h3 class="text-lg font-semibold truncate">{{ playlist.name }}</h3>
              </div>

              <!-- Description -->
              <p v-if="playlist.description" class="text-sm text-gray-400 mb-3 line-clamp-2">
                {{ playlist.description }}
              </p>

              <!-- Meta Info -->
              <div class="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                <div class="flex items-center gap-1.5">
                  <Icon icon="carbon:video" width="16" height="16" />
                  <span>{{ playlist.segment_count }} segment{{ playlist.segment_count !== 1 ? 's' : '' }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <Icon icon="carbon:calendar" width="16" height="16" />
                  <span>{{ formatDate(playlist.created_at) }}</span>
                </div>
                <div v-if="playlist.tags.length > 0" class="flex items-center gap-2">
                  <Icon icon="carbon:tag" width="16" height="16" />
                  <div class="flex gap-1 flex-wrap">
                    <span
                      v-for="tag in playlist.tags.slice(0, 3)"
                      :key="tag.id"
                      class="px-2 py-0.5 bg-white/10 rounded text-xs"
                    >
                      {{ tag.tag_key }}
                    </span>
                    <span v-if="playlist.tags.length > 3" class="px-2 py-0.5 bg-white/10 rounded text-xs">
                      +{{ playlist.tags.length - 3 }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="p-2 rounded hover:bg-white/10 transition opacity-0 group-hover:opacity-100"
                title="Delete playlist"
                @click.stop="requestDelete(playlist)"
              >
                <Icon icon="carbon:trash-can" width="20" height="20" class="text-red-400" />
              </button>
              <Icon icon="carbon:chevron-right" width="20" height="20" class="text-gray-400" />
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Create Playlist Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div class="bg-black border border-white/20 rounded-lg w-full max-w-lg">
        <div class="p-6 border-b border-white/20">
          <h2 class="text-xl font-semibold">Create Playlist</h2>
        </div>

        <div class="p-6 space-y-4">
          <div>
            <label for="playlist-name" class="block text-sm font-medium mb-2">Playlist Name</label>
            <input
              id="playlist-name"
              v-model="newPlaylistName"
              type="text"
              placeholder="Enter playlist name"
              class="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-white focus:outline-none"
              @keydown.enter="createPlaylist"
            />
          </div>

          <div>
            <label for="playlist-description" class="block text-sm font-medium mb-2">Description (optional)</label>
            <textarea
              id="playlist-description"
              v-model="newPlaylistDescription"
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
            :disabled="isCreating"
            @click="closeCreateModal"
          >
            Cancel
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-white text-black hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            :disabled="isCreating || !newPlaylistName.trim()"
            @click="createPlaylist"
          >
            <span v-if="isCreating" class="flex items-center gap-2">
              <Icon icon="carbon:circle-dash" class="animate-spin" width="16" height="16" />
              Creating...
            </span>
            <span v-else>Create Playlist</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <ConfirmDeleteModal
      :show="showDeleteModal"
      :item-name="playlistToDelete?.name || 'this playlist'"
      popup-title="Delete playlist?"
      :is-deleting="isDeleting"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false; playlistToDelete = null;"
    />
  </div>
</template>

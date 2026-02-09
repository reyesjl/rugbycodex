<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { toast } from '@/lib/toast';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue';

import { playlistService } from '@/modules/playlists/services/playlistService';
import type { PlaylistListItem } from '@/modules/playlists/types';

const props = defineProps<{
  orgId: string;
  segmentId: string;
  onClose: () => void;
  onAdded?: () => void;
}>();

const show = ref(true);
const loading = ref(false);
const error = ref<string | null>(null);

const playlists = ref<PlaylistListItem[]>([]);
const selectedPlaylistIds = ref<Set<string>>(new Set());
const showCreateNew = ref(false);
const newPlaylistName = ref('');
const newPlaylistDescription = ref('');

const sortedPlaylists = computed(() => {
  return [...playlists.value].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );
});

const handleClose = () => {
  if (!loading.value) {
    props.onClose();
  }
};

async function load() {
  loading.value = true;
  error.value = null;

  try {
    const data = await playlistService.listPlaylistsForOrg(props.orgId);
    playlists.value = data;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load playlists.';
  } finally {
    loading.value = false;
  }
}

function togglePlaylist(playlistId: string) {
  if (selectedPlaylistIds.value.has(playlistId)) {
    selectedPlaylistIds.value.delete(playlistId);
  } else {
    selectedPlaylistIds.value.add(playlistId);
  }
}

async function submit() {
  if (showCreateNew.value) {
    const trimmedName = newPlaylistName.value.trim();
    if (!trimmedName) {
      error.value = 'Please enter a playlist name.';
      return;
    }

    error.value = null;
    loading.value = true;

    try {
      const created = await playlistService.createPlaylist({
        orgId: props.orgId,
        name: trimmedName,
        description: newPlaylistDescription.value.trim() || null,
      });

      await playlistService.addSegmentToPlaylist(created.id, props.segmentId);

      toast({
        variant: 'success',
        message: `Playlist "${created.name}" created and segment added.`,
        durationMs: 2500,
      });

      props.onClose();
      props.onAdded?.();
    } catch (e) {
      toast({
        variant: 'error',
        message: e instanceof Error ? e.message : 'Failed to create playlist.',
        durationMs: 3500,
      });
    } finally {
      loading.value = false;
    }
  } else {
    if (selectedPlaylistIds.value.size === 0) {
      error.value = 'Please select at least one playlist.';
      return;
    }

    error.value = null;
    loading.value = true;

    try {
      const promises = Array.from(selectedPlaylistIds.value).map((playlistId) =>
        playlistService.addSegmentToPlaylist(playlistId, props.segmentId)
      );

      await Promise.all(promises);

      const count = selectedPlaylistIds.value.size;
      toast({
        variant: 'success',
        message: `Segment added to ${count} playlist${count > 1 ? 's' : ''}.`,
        durationMs: 2500,
      });

      props.onClose();
      props.onAdded?.();
    } catch (e) {
      toast({
        variant: 'error',
        message: e instanceof Error ? e.message : 'Failed to add segment to playlists.',
        durationMs: 3500,
      });
    } finally {
      loading.value = false;
    }
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <TransitionRoot :show="show">
    <Dialog @close="handleClose" class="relative z-70">
      <!-- Backdrop -->
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

      <!-- Dialog container -->
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
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-2xl text-white my-8">
              <header class="p-4 border-b border-b-white/20">
                <DialogTitle as="h2">Add to Playlist</DialogTitle>
                <p class="text-sm text-gray-400">Add this segment to existing playlists or create a new one.</p>
              </header>

              <div class="p-4 space-y-4">
                <!-- Error Display -->
                <div v-if="error" class="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {{ error }}
                </div>

                <!-- Toggle between modes -->
                <div class="inline-flex rounded-lg border border-white/15 overflow-hidden w-full">
                  <button
                    type="button"
                    class="flex-1 px-3 py-2 text-xs transition"
                    :class="!showCreateNew ? 'bg-white text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'"
                    @click="showCreateNew = false; error = null;"
                  >
                    Select Existing
                  </button>
                  <button
                    type="button"
                    class="flex-1 px-3 py-2 text-xs transition border-l border-white/10"
                    :class="showCreateNew ? 'bg-white text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'"
                    @click="showCreateNew = true; error = null;"
                  >
                    Create New
                  </button>
                </div>

                <!-- Create New Playlist Form -->
                <div v-if="showCreateNew" class="space-y-4">
                  <div class="flex flex-col gap-2">
                    <label class="text-sm" for="playlist-name">Playlist Name</label>
                    <input
                      id="playlist-name"
                      v-model="newPlaylistName"
                      class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                      placeholder="Enter playlist name"
                    />
                  </div>

                  <div class="flex flex-col gap-2">
                    <label class="text-sm" for="playlist-description">Description (optional)</label>
                    <textarea
                      id="playlist-description"
                      v-model="newPlaylistDescription"
                      class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none resize-none"
                      placeholder="Enter description"
                      rows="3"
                    />
                  </div>
                </div>

                <!-- Select Existing Playlists -->
                <div v-else class="space-y-2">
                  <p class="text-sm text-gray-400">Select one or more playlists:</p>

                  <div v-if="loading" class="text-center py-8 text-gray-400">
                    <Icon icon="carbon:circle-dash" class="animate-spin mx-auto" width="24" height="24" />
                    <p class="text-sm mt-2">Loading playlists...</p>
                  </div>

                  <div v-else-if="sortedPlaylists.length === 0" class="text-center py-8 text-gray-400">
                    <Icon icon="carbon:playlist" width="48" height="48" class="mx-auto mb-2 opacity-50" />
                    <p class="text-sm">No playlists yet.</p>
                    <p class="text-xs mt-1">Create one to get started.</p>
                  </div>

                  <div v-else class="max-h-64 overflow-y-auto space-y-2 border border-white/10 rounded p-2">
                    <button
                      v-for="playlist in sortedPlaylists"
                      :key="playlist.id"
                      type="button"
                      class="w-full flex items-center gap-3 px-3 py-2 rounded transition hover:bg-white/5"
                      :class="selectedPlaylistIds.has(playlist.id) ? 'bg-white/10 border border-white/20' : 'border border-transparent'"
                      @click="togglePlaylist(playlist.id)"
                    >
                      <div class="flex-shrink-0">
                        <Icon
                          :icon="selectedPlaylistIds.has(playlist.id) ? 'carbon:checkbox-checked' : 'carbon:checkbox'"
                          width="20"
                          height="20"
                          :class="selectedPlaylistIds.has(playlist.id) ? 'text-white' : 'text-gray-400'"
                        />
                      </div>
                      <div class="flex-1 text-left">
                        <div class="text-sm font-medium">{{ playlist.name }}</div>
                        <div class="text-xs text-gray-400">
                          {{ playlist.segment_count }} segment{{ playlist.segment_count !== 1 ? 's' : '' }}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <footer class="p-4 border-t border-t-white/20 flex justify-end gap-2">
                <button
                  type="button"
                  class="px-4 py-2 rounded bg-white/10 hover:bg-white/20 transition"
                  :disabled="loading"
                  @click="handleClose"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="px-4 py-2 rounded bg-white text-black hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="loading"
                  @click="submit"
                >
                  <span v-if="loading">
                    <Icon icon="carbon:circle-dash" class="animate-spin inline" width="16" height="16" />
                    {{ showCreateNew ? 'Creating...' : 'Adding...' }}
                  </span>
                  <span v-else>
                    {{ showCreateNew ? 'Create & Add' : 'Add to Playlist' }}
                  </span>
                </button>
              </footer>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

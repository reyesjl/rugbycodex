<script setup lang="ts">
import { ref } from 'vue';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import type { AdminMediaAssetListItem } from '@/modules/media/types/AdminMediaAssetListItem';

defineProps<{
  mediaAsset: AdminMediaAssetListItem;
}>();

const emit = defineEmits<{
  close: [];
}>();

const show = ref(true);

function handleClose() {
  emit('close');
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'ready': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'processing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'uploading': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'failed': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    case 'interrupted': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
}

function getKindBadgeColor(kind: string): string {
  switch (kind) {
    case 'match': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'training': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'clinic': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
}
</script>

<template>
  <TransitionRoot appear :show="show" as="template">
    <Dialog as="div" @close="handleClose" class="relative z-70">
      <!-- Backdrop -->
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-3xl text-white my-8">
              <!-- Header -->
              <header class="p-4 border-b border-b-white/20">
                <DialogTitle as="h2" class="text-lg font-semibold">
                  Media Asset Details
                </DialogTitle>
              </header>

              <!-- Body -->
              <div class="p-4 space-y-6">
                <!-- File Info -->
                <div>
                  <h3 class="text-sm font-medium text-white/60 mb-2">File Information</h3>
                  <div class="space-y-2">
                    <div class="flex items-start gap-2">
                      <Icon icon="ph:file-video" class="h-5 w-5 text-white/40 flex-shrink-0 mt-0.5" />
                      <div class="flex-1 min-w-0">
                        <div class="font-medium break-all">{{ mediaAsset.file_name }}</div>
                        <div class="text-sm text-white/60 mt-1">
                          {{ formatFileSize(mediaAsset.file_size_bytes) }} • {{ mediaAsset.mime_type }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Status & Kind -->
                <div class="flex flex-wrap gap-3">
                  <div>
                    <h3 class="text-sm font-medium text-white/60 mb-2">Status</h3>
                    <span 
                      class="inline-flex px-3 py-1 text-sm font-medium rounded border capitalize"
                      :class="getStatusBadgeColor(mediaAsset.status)"
                    >
                      {{ mediaAsset.status }}
                    </span>
                  </div>
                  <div>
                    <h3 class="text-sm font-medium text-white/60 mb-2">Type</h3>
                    <span 
                      class="inline-flex px-3 py-1 text-sm font-medium rounded border capitalize"
                      :class="getKindBadgeColor(mediaAsset.kind)"
                    >
                      {{ mediaAsset.kind }}
                    </span>
                  </div>
                  <div>
                    <h3 class="text-sm font-medium text-white/60 mb-2">Duration</h3>
                    <div class="text-sm">{{ formatDuration(mediaAsset.duration_seconds) }}</div>
                  </div>
                </div>

                <!-- Processing Info -->
                <div v-if="mediaAsset.processing_stage || mediaAsset.transcode_progress !== null">
                  <h3 class="text-sm font-medium text-white/60 mb-2">Processing</h3>
                  <div class="space-y-2">
                    <div v-if="mediaAsset.processing_stage" class="text-sm">
                      <span class="text-white/60">Stage:</span> {{ mediaAsset.processing_stage }}
                    </div>
                    <div v-if="mediaAsset.transcode_progress !== null" class="text-sm">
                      <span class="text-white/60">Progress:</span> {{ mediaAsset.transcode_progress }}%
                      <div class="mt-1 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div 
                          class="h-full bg-blue-500 transition-all duration-300"
                          :style="{ width: `${mediaAsset.transcode_progress}%` }"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Streaming Info -->
                <div>
                  <h3 class="text-sm font-medium text-white/60 mb-2">Streaming</h3>
                  <div class="flex items-center gap-2 text-sm">
                    <Icon 
                      :icon="mediaAsset.streaming_ready ? 'ph:check-circle' : 'ph:x-circle'" 
                      :class="[
                        'h-4 w-4',
                        mediaAsset.streaming_ready ? 'text-green-400' : 'text-rose-400'
                      ]"
                    />
                    <span>{{ mediaAsset.streaming_ready ? 'Ready for streaming' : 'Not ready' }}</span>
                  </div>
                  <div v-if="mediaAsset.thumbnail_path" class="mt-2 text-xs text-white/40">
                    Thumbnail: {{ mediaAsset.thumbnail_path }}
                  </div>
                </div>

                <!-- Uploader Info -->
                <div>
                  <h3 class="text-sm font-medium text-white/60 mb-2">Uploader</h3>
                  <div class="flex items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                      <Icon icon="ph:user" class="h-5 w-5 text-white/60" />
                    </div>
                    <div>
                      <div class="font-medium">{{ mediaAsset.uploader_name || 'Unknown' }}</div>
                      <div class="text-sm text-white/60">@{{ mediaAsset.uploader_username || 'N/A' }}</div>
                    </div>
                  </div>
                </div>

                <!-- Organization Info -->
                <div>
                  <h3 class="text-sm font-medium text-white/60 mb-2">Organization</h3>
                  <div class="flex items-center gap-2 text-sm">
                    <Icon icon="ph:users-three" class="h-4 w-4 text-white/40" />
                    <span>{{ mediaAsset.org_name || 'N/A' }}</span>
                  </div>
                </div>

                <!-- Storage Info -->
                <div>
                  <h3 class="text-sm font-medium text-white/60 mb-2">Storage</h3>
                  <div class="space-y-1 text-sm">
                    <div><span class="text-white/60">Bucket:</span> <span class="font-mono">{{ mediaAsset.bucket }}</span></div>
                    <div class="text-xs text-white/40 font-mono break-all">
                      {{ mediaAsset.storage_path }}
                    </div>
                  </div>
                </div>

                <!-- Metadata -->
                <div class="pt-4 border-t border-white/10">
                  <h3 class="text-sm font-medium text-white/60 mb-2">Metadata</h3>
                  <div class="text-sm">
                    <div><span class="text-white/60">Created:</span> {{ formatDate(mediaAsset.created_at) }}</div>
                  </div>
                </div>

                <!-- IDs (for debugging) -->
                <details class="text-xs">
                  <summary class="cursor-pointer text-white/40 hover:text-white/60">Technical IDs</summary>
                  <div class="mt-2 space-y-1 font-mono text-white/60">
                    <div>Media Asset ID: {{ mediaAsset.id }}</div>
                    <div>Org ID: {{ mediaAsset.org_id }}</div>
                    <div>Uploader ID: {{ mediaAsset.uploader_id }}</div>
                  </div>
                </details>
              </div>

              <!-- Footer -->
              <div class="flex justify-end p-4 border-t border-t-white/20">
                <button
                  type="button"
                  class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
                  @click="handleClose"
                >
                  Close
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

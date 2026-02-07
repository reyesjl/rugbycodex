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
import type { AdminNarrationListItem } from '@/modules/narrations/types/AdminNarrationListItem';

const props = defineProps<{
  narration: AdminNarrationListItem;
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

function getSourceBadgeColor(sourceType: string): string {
  switch (sourceType) {
    case 'coach': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'staff': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'member': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
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
                  Narration Details
                </DialogTitle>
              </header>

              <!-- Body -->
              <div class="p-4 space-y-6">
                <!-- Author Info -->
                <div>
                  <h3 class="text-sm font-medium text-white/60 mb-2">Author</h3>
                  <div class="flex items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                      <Icon icon="ph:user" class="h-5 w-5 text-white/60" />
                    </div>
                    <div>
                      <div class="font-medium">{{ narration.author_name || 'Unknown' }}</div>
                      <div class="text-sm text-white/60">@{{ narration.author_username || 'N/A' }}</div>
                    </div>
                    <span 
                      class="ml-auto px-2 py-1 text-xs font-medium rounded border capitalize"
                      :class="getSourceBadgeColor(narration.source_type)"
                    >
                      {{ narration.source_type }}
                    </span>
                  </div>
                </div>

                <!-- Organization Info -->
                <div>
                  <h3 class="text-sm font-medium text-white/60 mb-2">Organization</h3>
                  <div class="flex items-center gap-2 text-sm">
                    <Icon icon="ph:users-three" class="h-4 w-4 text-white/40" />
                    <span>{{ narration.org_name || 'N/A' }}</span>
                  </div>
                </div>

                <!-- Media Asset Info -->
                <div>
                  <h3 class="text-sm font-medium text-white/60 mb-2">Media Asset</h3>
                  <div class="flex items-center gap-2 text-sm">
                    <Icon icon="ph:video" class="h-4 w-4 text-white/40" />
                    <span>{{ narration.media_asset_title || 'Untitled' }}</span>
                  </div>
                  <div class="mt-1 text-xs text-white/40">
                    Segment ID: {{ narration.media_asset_segment_id }}
                  </div>
                </div>

                <!-- Transcript -->
                <div>
                  <h3 class="text-sm font-medium text-white/60 mb-2">Transcript (Raw)</h3>
                  <div class="rounded-lg border border-white/20 bg-white/5 p-3 text-sm text-white/80 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {{ narration.transcript_raw }}
                  </div>
                </div>

                <!-- Clean Transcript (if exists) -->
                <div v-if="narration.transcript_clean">
                  <h3 class="text-sm font-medium text-white/60 mb-2">Transcript (Cleaned)</h3>
                  <div class="rounded-lg border border-white/20 bg-white/5 p-3 text-sm text-white/80 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {{ narration.transcript_clean }}
                  </div>
                </div>

                <!-- Language -->
                <div v-if="narration.transcript_lang">
                  <h3 class="text-sm font-medium text-white/60 mb-2">Detected Language</h3>
                  <div class="text-sm">{{ narration.transcript_lang }}</div>
                </div>

                <!-- Audio Path -->
                <div v-if="narration.audio_storage_path">
                  <h3 class="text-sm font-medium text-white/60 mb-2">Audio File</h3>
                  <div class="text-sm text-white/60 font-mono break-all">
                    {{ narration.audio_storage_path }}
                  </div>
                </div>

                <!-- Metadata -->
                <div class="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  <div>
                    <h3 class="text-sm font-medium text-white/60 mb-1">Created</h3>
                    <div class="text-sm">{{ formatDate(narration.created_at) }}</div>
                  </div>
                  <div>
                    <h3 class="text-sm font-medium text-white/60 mb-1">Updated</h3>
                    <div class="text-sm">{{ formatDate(narration.updated_at) }}</div>
                  </div>
                </div>

                <!-- IDs (for debugging) -->
                <details class="text-xs">
                  <summary class="cursor-pointer text-white/40 hover:text-white/60">Technical IDs</summary>
                  <div class="mt-2 space-y-1 font-mono text-white/60">
                    <div>Narration ID: {{ narration.id }}</div>
                    <div>Media Asset ID: {{ narration.media_asset_id }}</div>
                    <div>Org ID: {{ narration.org_id }}</div>
                    <div v-if="narration.author_id">Author ID: {{ narration.author_id }}</div>
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

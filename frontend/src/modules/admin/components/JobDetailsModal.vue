<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import type { AdminJobListItem } from '@/modules/orgs/types/AdminJobListItem';

const props = defineProps<{
  job: AdminJobListItem;
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

function formatDuration(startDate: Date, endDate: Date | null): string {
  const end = endDate || new Date();
  const diffMs = end.getTime() - startDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  
  if (diffSecs < 60) return `${diffSecs}s`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ${diffSecs % 60}s`;
  const hours = Math.floor(diffSecs / 3600);
  const minutes = Math.floor((diffSecs % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function getStateBadgeColor(state: string): string {
  switch (state) {
    case 'queued': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    case 'running': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'succeeded': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'failed': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    case 'canceled': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
}

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'transcoding': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
}

const progressPercent = computed(() => {
  return Math.round((props.job.progress || 0) * 100);
});
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
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-2xl text-white my-8">
              <!-- Header -->
              <header class="flex items-center justify-between p-4 border-b border-b-white/20">
                <div class="flex items-center gap-3">
                  <Icon icon="ph:briefcase" class="h-6 w-6 text-white/60" />
                  <DialogTitle class="text-lg font-medium">Job Details</DialogTitle>
                </div>
                <button
                  @click="handleClose"
                  class="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white transition"
                >
                  <Icon icon="ph:x" class="h-5 w-5" />
                </button>
              </header>

              <!-- Body -->
              <div class="p-4 space-y-4">
                <!-- Job ID -->
                <div>
                  <h3 class="text-sm font-medium text-white/60 mb-1">Job ID</h3>
                  <p class="text-sm font-mono">{{ job.id }}</p>
                </div>

                <!-- Type and State -->
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <h3 class="text-sm font-medium text-white/60 mb-2">Type</h3>
                    <span :class="['inline-flex px-3 py-1 text-sm font-medium rounded border capitalize', getTypeBadgeColor(job.type)]">
                      {{ job.type }}
                    </span>
                  </div>
                  <div>
                    <h3 class="text-sm font-medium text-white/60 mb-2">State</h3>
                    <span :class="['inline-flex px-3 py-1 text-sm font-medium rounded border capitalize', getStateBadgeColor(job.state)]">
                      {{ job.state }}
                    </span>
                  </div>
                </div>

                <!-- Progress (for running jobs) -->
                <div v-if="job.state === 'running'">
                  <h3 class="text-sm font-medium text-white/60 mb-2">Progress</h3>
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-sm">
                      <span>{{ progressPercent }}% Complete</span>
                      <span class="text-white/60">{{ progressPercent }}/100</span>
                    </div>
                    <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div 
                        class="bg-blue-500 h-full transition-all duration-300"
                        :style="{ width: `${progressPercent}%` }"
                      />
                    </div>
                  </div>
                </div>

                <!-- Error Details (for failed jobs) -->
                <div v-if="job.state === 'failed' && (job.error_code || job.error_message)">
                  <h3 class="text-sm font-medium text-white/60 mb-2">Error Details</h3>
                  <div class="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 space-y-2">
                    <div v-if="job.error_code" class="flex items-start gap-2">
                      <Icon icon="ph:warning" class="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
                      <div class="text-sm">
                        <span class="text-white/60">Error Code:</span>
                        <span class="text-rose-400 ml-2 font-mono">{{ job.error_code }}</span>
                      </div>
                    </div>
                    <div v-if="job.error_message" class="text-sm text-rose-400">
                      {{ job.error_message }}
                    </div>
                  </div>
                </div>

                <!-- Organization -->
                <div>
                  <h3 class="text-sm font-medium text-white/60 mb-1">Organization</h3>
                  <p class="text-sm">{{ job.org_name || 'Unknown Organization' }}</p>
                </div>

                <!-- Creator -->
                <div v-if="job.creator_name || job.creator_username">
                  <h3 class="text-sm font-medium text-white/60 mb-1">Created By</h3>
                  <p class="text-sm">
                    {{ job.creator_name || 'Unknown' }}
                    <span v-if="job.creator_username" class="text-white/60">(@{{ job.creator_username }})</span>
                  </p>
                </div>

                <!-- Attempt -->
                <div v-if="job.attempt > 1">
                  <h3 class="text-sm font-medium text-white/60 mb-1">Retry Attempt</h3>
                  <p class="text-sm">Attempt {{ job.attempt }}</p>
                </div>

                <!-- Related Resources -->
                <div v-if="job.media_asset_id || job.media_asset_segment_id || job.narration_id">
                  <h3 class="text-sm font-medium text-white/60 mb-2">Related Resources</h3>
                  <div class="space-y-1 text-sm">
                    <div v-if="job.media_asset_id" class="flex items-center gap-2">
                      <Icon icon="ph:file-video" class="h-4 w-4 text-white/40" />
                      <span class="text-white/60">Media Asset:</span>
                      <span class="font-mono text-xs">{{ job.media_asset_id }}</span>
                    </div>
                    <div v-if="job.media_asset_segment_id" class="flex items-center gap-2">
                      <Icon icon="ph:scissors" class="h-4 w-4 text-white/40" />
                      <span class="text-white/60">Segment:</span>
                      <span class="font-mono text-xs">{{ job.media_asset_segment_id }}</span>
                    </div>
                    <div v-if="job.narration_id" class="flex items-center gap-2">
                      <Icon icon="ph:microphone" class="h-4 w-4 text-white/40" />
                      <span class="text-white/60">Narration:</span>
                      <span class="font-mono text-xs">{{ job.narration_id }}</span>
                    </div>
                  </div>
                </div>

                <!-- Timestamps -->
                <div class="border-t border-white/10 pt-4 space-y-2">
                  <h3 class="text-sm font-medium text-white/60 mb-2">Timeline</h3>
                  <div class="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span class="text-white/60">Created:</span>
                      <p class="mt-0.5">{{ formatDate(job.created_at) }}</p>
                    </div>
                    <div v-if="job.started_at">
                      <span class="text-white/60">Started:</span>
                      <p class="mt-0.5">{{ formatDate(job.started_at) }}</p>
                    </div>
                    <div v-if="job.finished_at">
                      <span class="text-white/60">Finished:</span>
                      <p class="mt-0.5">{{ formatDate(job.finished_at) }}</p>
                    </div>
                    <div v-if="job.started_at && (job.finished_at || job.state === 'running')">
                      <span class="text-white/60">Duration:</span>
                      <p class="mt-0.5">{{ formatDuration(job.started_at, job.finished_at) }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="flex justify-end p-4 border-t border-t-white/20">
                <button
                  @click="handleClose"
                  class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
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

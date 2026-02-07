<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue';
import type { AdminNarrationListItem } from '@/modules/narrations/types/AdminNarrationListItem';

const props = defineProps<{
  narration: AdminNarrationListItem;
}>();

const emit = defineEmits<{
  close: [];
  submit: [transcriptRaw: string];
}>();

const show = ref(true);
const transcriptRaw = ref('');
const validationError = ref<string | null>(null);

// Initialize form when narration changes
watch(() => props.narration, (narration) => {
  transcriptRaw.value = narration.transcript_raw;
  validationError.value = null;
}, { immediate: true });

function validateForm(): string | null {
  if (!transcriptRaw.value.trim()) {
    return 'Transcript cannot be empty';
  }
  if (transcriptRaw.value.length > 10000) {
    return 'Transcript too long (max 10,000 characters)';
  }
  return null;
}

function handleSubmit() {
  const error = validateForm();
  if (error) {
    validationError.value = error;
    return;
  }
  emit('submit', transcriptRaw.value.trim());
}

function handleClose() {
  emit('close');
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
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-2xl text-white my-8">
              <!-- Header -->
              <header class="p-4 border-b border-b-white/20">
                <DialogTitle as="h2" class="text-lg font-semibold">
                  Edit Narration Transcript
                </DialogTitle>
              </header>

              <!-- Body -->
              <div class="p-4 space-y-4">
                <!-- Narration info -->
                <div class="text-sm text-white/60 space-y-1">
                  <div><span class="text-white/40">Author:</span> {{ narration.author_name || 'Unknown' }} ({{ narration.author_username }})</div>
                  <div><span class="text-white/40">Organization:</span> {{ narration.org_name || 'N/A' }}</div>
                  <div><span class="text-white/40">Media:</span> {{ narration.media_asset_title || 'Untitled' }}</div>
                </div>

                <!-- Transcript textarea -->
                <div>
                  <label for="transcript" class="block text-sm font-medium text-white/80 mb-2">
                    Transcript
                  </label>
                  <textarea
                    id="transcript"
                    v-model="transcriptRaw"
                    rows="12"
                    class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/40 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter narration transcript..."
                  />
                  <div class="mt-1 text-xs text-white/40">
                    {{ transcriptRaw.length }} / 10,000 characters
                  </div>
                </div>

                <!-- Validation error -->
                <div v-if="validationError" class="text-sm text-rose-400">
                  {{ validationError }}
                </div>
              </div>

              <!-- Footer -->
              <div class="flex justify-between p-4 border-t border-t-white/20">
                <button
                  @click="handleClose"
                  class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
                >
                  Cancel
                </button>
                <button
                  @click="handleSubmit"
                  class="px-4 py-2 text-sm rounded-lg border border-blue-500 bg-blue-500/70 hover:bg-blue-700/70 transition disabled:opacity-50"
                  :disabled="!transcriptRaw.trim()"
                >
                  Save Changes
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

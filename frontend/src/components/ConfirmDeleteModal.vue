<script setup lang="ts">
import { TransitionRoot, TransitionChild, Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';

interface Props {
  show: boolean;
  itemName: string;
  popupTitle: string;
  isDeleting?: boolean;
  error?: string | null;
}

interface Emits {
  (e: 'confirm'): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}

const props = withDefaults(defineProps<Props>(), {
  isDeleting: false,
  error: null
});

const emit = defineEmits<Emits>();

function handleClose() {
  if (!props.isDeleting) {
    emit('close');
  }
}

function handleCancel() {
  if (!props.isDeleting) {
    emit('cancel');
  }
}
</script>

<template>
  <TransitionRoot appear :show="show" as="template">
    <Dialog as="div" @close="handleClose" class="relative z-[70]">
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

      <!-- Dialog positioning -->
      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <!-- Dialog panel -->
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-xl transform overflow-hidden rounded-lg bg-black border border-white/20 text-white shadow-xl transition-all">
              <!-- Header -->
              <header class="p-4 border-b border-b-white/20">
                <DialogTitle as="h2" class="text-lg font-medium">
                  {{ popupTitle }}
                </DialogTitle>
                <p class="text-sm text-gray-400 mt-1">
                  Are you sure you want to delete <strong>{{ itemName }}</strong>? This action cannot be undone.
                </p>
              </header>

              <!-- Error section -->
              <div v-if="error" class="p-4">
                <p class="text-xs text-red-400">{{ error }}</p>
              </div>

              <!-- Footer -->
              <div class="flex justify-between p-4 border-t border-t-white/20">
                <button
                  @click="handleCancel"
                  class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
                  :disabled="isDeleting"
                >
                  Cancel
                </button>
                <button
                  @click="emit('confirm')"
                  class="px-4 py-2 text-sm rounded-lg border border-red-500 bg-red-500/70 hover:bg-red-700/70 transition disabled:opacity-50"
                  :disabled="isDeleting"
                >
                  <span v-if="isDeleting">Deleting...</span>
                  <span v-else>Delete</span>
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<style scoped>
/* intentionally empty: swiss-style = let spacing + type do the work */
</style>

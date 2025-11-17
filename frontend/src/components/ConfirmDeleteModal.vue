<script setup lang="ts">
import { Icon } from '@iconify/vue';

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

const handleBackdropClick = () => {
  if (!props.isDeleting) {
    emit('close');
  }
};

const handleCancel = () => {
  if (!props.isDeleting) {
    emit('cancel');
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" @click="handleBackdropClick"></div>

        <!-- Modal -->
        <div
          class="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_40px_120px_rgba(15,23,42,0.3)] dark:bg-neutral-950 dark:shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
          <div class="flex items-start gap-4">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/50">
              <Icon icon="mdi:alert-circle-outline" class="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>

            <div class="flex-1">
              <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {{ popupTitle }}
              </h3>
              <p class="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                Are you sure you want to delete <strong class="font-semibold text-neutral-900 dark:text-neutral-100">{{
                  itemName }}</strong>?
                This action cannot be undone and will permanently remove all associated data.
              </p>

              <div v-if="error" class="mt-4 rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30">
                <p class="text-sm text-rose-600 dark:text-rose-400">{{ error }}</p>
              </div>

              <div class="mt-6 flex gap-3">
                <button type="button" @click="emit('confirm')" :disabled="isDeleting"
                  class="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-500 dark:hover:bg-rose-600">
                  <span v-if="isDeleting" class="flex items-center justify-center gap-2">
                    <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                    Deleting...
                  </span>
                  <span v-else>Delete</span>
                </button>

                <button type="button" @click="handleCancel" :disabled="isDeleting"
                  class="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Modal animation */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active>div:last-child,
.modal-leave-active>div:last-child {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from>div:last-child,
.modal-leave-to>div:last-child {
  transform: scale(0.95) translateY(-20px);
}
</style>

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
    <Transition name="modal-fade">
      <div
        v-if="show"
        class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
        role="dialog"
        aria-modal="true"
        aria-label="Delete confirmation"
        @click.self="handleBackdropClick"
      >
        <div class="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-[#0f1016] text-white shadow-2xl">
          <header class="flex items-center gap-3 border-b border-white/10 px-6 py-4">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-300">
              <Icon icon="carbon:warning-alt" class="h-5 w-5" />
            </div>
            <div>
              <p class="text-xs uppercase tracking-wide text-white/50">Confirm delete</p>
              <h2 class="text-xl font-semibold leading-tight">{{ popupTitle }}</h2>
            </div>
          </header>

          <div class="space-y-4 px-6 py-5">
            <p class="text-sm text-white/80">
              Are you sure you want to delete
              <strong class="font-semibold text-white">{{ itemName }}</strong>? This action cannot be undone and will
              permanently remove all associated data.
            </p>
            <div v-if="error" class="rounded border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {{ error }}
            </div>
          </div>

          <div class="flex justify-end gap-3 border-t border-white/10 bg-black/40 px-6 py-4">
            <button
              type="button"
              class="rounded border border-white/30 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isDeleting"
              @click="handleCancel"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded border border-rose-500 bg-rose-600 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isDeleting"
              @click="emit('confirm')"
            >
              <span v-if="isDeleting" class="flex items-center justify-center gap-2">
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                Deleting…
              </span>
              <span v-else>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>

<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionRoot,
  TransitionChild,
} from '@headlessui/vue';

interface Props {
  show: boolean;
  popupTitle: string;
  message: string;
  buttonLabel?: string;
  isWorking?: boolean;
  error?: string | null;
}

interface Emits {
  (e: 'close'): void;
}

const props = withDefaults(defineProps<Props>(), {
  buttonLabel: 'Okay',
  isWorking: false,
  error: null,
});

const emit = defineEmits<Emits>();

const handleClose = () => {
  if (!props.isWorking) {
    emit('close');
  }
};
</script>

<template>
  <TransitionRoot :show="show">
    <Dialog @close="handleClose" class="relative z-[70]">
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
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-xl text-white my-8">
            <!-- Header -->
            <header class="p-4 border-b border-b-white/20">
              <DialogTitle as="h2">{{ popupTitle }}</DialogTitle>
              <p class="text-sm text-gray-400">
                {{ message }}
              </p>
            </header>

            <!-- Error section -->
            <div v-if="error" class="p-4">
              <p class="text-xs text-red-400">{{ error }}</p>
            </div>

            <!-- Footer -->
            <div class="flex justify-end p-4 border-t border-t-white/20">
              <button
                @click="handleClose"
                class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
                :disabled="isWorking"
              >
                {{ buttonLabel }}
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

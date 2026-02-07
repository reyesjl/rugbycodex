<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';

interface Props {
  show: boolean;
  requestName: string;
  requesterName: string;
  loading?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const handleClose = () => {
  if (props.loading) return;
  emit('close');
};

const handleConfirm = () => {
  emit('confirm');
};
</script>

<template>
  <TransitionRoot :show="show" as="template">
    <Dialog as="div" class="relative z-70" @close="handleClose">
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
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-md text-white my-8">
              <!-- Header -->
              <header class="p-4 border-b border-b-white/20">
                <DialogTitle as="h2" class="text-lg font-semibold">
                  Approve Organization Request
                </DialogTitle>
              </header>

              <!-- Body -->
              <div class="p-4 space-y-4">
                <p class="text-sm text-white/70">
                  Are you sure you want to approve this organization request? This will create a new organization.
                </p>

                <div class="rounded border border-white/10 bg-white/5 p-3 space-y-2">
                  <div>
                    <div class="text-xs text-white/50 uppercase tracking-wider">Organization Name</div>
                    <div class="mt-1 text-sm font-semibold text-white">{{ requestName }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-white/50 uppercase tracking-wider">Requester</div>
                    <div class="mt-1 text-sm text-white/70">{{ requesterName }}</div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="flex justify-between p-4 border-t border-t-white/20">
                <button
                  type="button"
                  class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
                  @click="handleClose"
                  :disabled="loading"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="px-4 py-2 text-sm rounded-lg border border-green-500 bg-green-500/70 hover:bg-green-700/70 transition disabled:opacity-50"
                  @click="handleConfirm"
                  :disabled="loading"
                >
                  <span v-if="loading">Approving...</span>
                  <span v-else>Approve</span>
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

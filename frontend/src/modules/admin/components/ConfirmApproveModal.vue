<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { Icon } from '@iconify/vue';

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
    <Dialog as="div" class="relative z-50" @close="handleClose">
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/75 backdrop-blur-sm" />
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
            <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-lg border border-white/20 bg-gray-900 text-left align-middle shadow-xl transition-all">
              <!-- Header -->
              <div class="flex items-start justify-between border-b border-white/10 px-6 py-4">
                <DialogTitle as="h3" class="text-lg font-semibold text-white">
                  Approve Organization Request
                </DialogTitle>
                <button
                  type="button"
                  class="text-white/40 transition hover:text-white/70"
                  @click="handleClose"
                  :disabled="loading"
                >
                  <Icon icon="carbon:close" class="h-5 w-5" />
                </button>
              </div>

              <!-- Body -->
              <div class="px-6 py-4 space-y-4">
                <p class="text-sm text-white/70">
                  Are you sure you want to approve this organization request? This will create a new organization.
                </p>

                <div class="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
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
              <div class="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
                <button
                  type="button"
                  class="rounded border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                  @click="handleClose"
                  :disabled="loading"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="rounded border border-emerald-400 bg-emerald-500/70 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
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

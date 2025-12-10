<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';

export type BatchAction = {
  id: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onClick?: () => void | Promise<void>;
};

const props = defineProps<{
  selectedCount: number;
  actions?: BatchAction[];
  cancelLabel?: string;
  cancelDisabled?: boolean;
}>();

const emit = defineEmits<{ cancel: [] }>();
const resolvedActions = computed(() => props.actions ?? []);
const actionLoadingId = ref<string | null>(null);

const handleActionClick = async (action: BatchAction) => {
  if (action.disabled || !action.onClick) return;
  const maybePromise = action.onClick();
  if (maybePromise && typeof (maybePromise as Promise<unknown>).then === 'function') {
    actionLoadingId.value = action.id;
    try {
      await maybePromise;
    } finally {
      actionLoadingId.value = null;
    }
  }
};

const handleCancel = () => {
  emit('cancel');
};

const buttonClasses = (action: BatchAction) => [
  'flex items-center gap-1 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline-2 focus-visible:outline-white/70 disabled:cursor-not-allowed disabled:opacity-45',
  action.variant === 'primary'
    ? 'border-transparent bg-white text-blue-700 hover:bg-blue-50'
    : 'border-white/50 text-white hover:bg-white/10'
];
</script>

<template>
  <transition name="batch-bar" appear>
    <div v-if="selectedCount > 0" class="fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div class="min-w-[320px] max-w-4xl flex-1 rounded-full border border-blue-100/40 bg-blue-600 text-white shadow-2xl shadow-blue-900/40">
        <div class="flex flex-col gap-3 px-6 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <p class="font-medium uppercase tracking-wide text-white/80">
            {{ selectedCount }} item{{ selectedCount === 1 ? '' : 's' }} selected
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="action in resolvedActions"
              :key="action.id"
              type="button"
              :class="buttonClasses(action)"
              :disabled="action.disabled || actionLoadingId === action.id"
              @click="handleActionClick(action)"
            >
              <Icon v-if="action.icon" :icon="action.icon" class="h-4 w-4" />
              <span>
                {{ actionLoadingId === action.id ? 'Working…' : action.label }}
              </span>
            </button>
            <span class="hidden h-4 w-px bg-white/40 md:inline-block" />
            <button
              type="button"
              class="rounded-full border border-transparent px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/70 disabled:cursor-not-allowed disabled:opacity-45"
              :disabled="cancelDisabled"
              @click="handleCancel"
            >
              {{ cancelLabel ?? 'Cancel' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.batch-bar-enter-active,
.batch-bar-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.batch-bar-enter-from,
.batch-bar-leave-to {
  opacity: 0;
  transform: translateY(16px);
}
</style>

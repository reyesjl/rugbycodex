<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, ref } from 'vue';
import type { PropType } from 'vue';

const props = defineProps({
  refresh: {
    type: Function as PropType<() => Promise<void> | void>,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: 'Refresh',
  },
  resetDelay: {
    type: Number,
    default: 1200,
  },
  size: {
    type: String as PropType<'sm' | 'md'>,
    default: 'md',
  },
});

const emit = defineEmits<{
  (e: 'refreshed'): void;
  (e: 'error', error: unknown): void;
}>();

const internalLoading = ref(false);
const showSuccess = ref(false);
let resetTimer: ReturnType<typeof setTimeout> | null = null;

const buttonPaddingClass = computed(() => (props.size === 'sm' ? 'p-1.5' : 'p-2'));
const iconSizeClass = computed(() => (props.size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'));

const isBusy = computed(() => props.loading || internalLoading.value);
const isButtonDisabled = computed(() => props.disabled || isBusy.value);

const buttonStateClass = computed(() =>
  showSuccess.value
    ? 'text-green-500 hover:bg-green-100 focus-visible:outline-green-600 dark:text-green-400 dark:hover:bg-green-900/30 dark:focus-visible:outline-green-400'
    : 'text-neutral-900 hover:bg-neutral-200 focus-visible:outline-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800 dark:focus-visible:outline-neutral-100'
);

const currentIcon = computed(() => (showSuccess.value ? 'carbon:checkmark' : 'mdi:refresh'));

const clearResetTimer = () => {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
};

const handleClick = async () => {
  if (isButtonDisabled.value) return;
  showSuccess.value = false;
  internalLoading.value = true;
  clearResetTimer();

  try {
    await props.refresh();
    showSuccess.value = true;
    emit('refreshed');
  } catch (error) {
    emit('error', error);
    console.error(error);
  } finally {
    internalLoading.value = false;
    clearResetTimer();
    resetTimer = setTimeout(() => {
      showSuccess.value = false;
    }, props.resetDelay);
  }
};

onBeforeUnmount(() => {
  clearResetTimer();
});
</script>

<template>
  <button
    type="button"
    :title="title"
    class="inline-flex items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-offset-2"
    :class="[buttonPaddingClass, buttonStateClass]"
    :disabled="isButtonDisabled"
    @click="handleClick"
  >
    <Icon
      :icon="currentIcon"
      :class="[iconSizeClass, { 'animate-spin': isBusy && !showSuccess }]"
    />
    <slot />
  </button>
</template>

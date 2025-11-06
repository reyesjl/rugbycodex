<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  url?: string;
  label?: string;
  copiedText?: string;
  icon?: string;
}>();

const emit = defineEmits<{
  (e: 'copied', value: string): void;
  (e: 'copy-error', error: unknown): void;
}>();

const copied = ref(false);
const copying = ref(false);
let resetTimer: number | undefined;

const copyLabel = computed(() => props.label ?? 'Share');
const copiedLabel = computed(() => props.copiedText ?? 'Copied!');
const iconName = computed(() => props.icon ?? 'carbon:link');

const href = computed(() => {
  if (props.url) {
    return props.url;
  }
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.href;
});

const fallbackCopy = (text: string) => {
  if (typeof document === 'undefined') {
    throw new Error('Clipboard unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const originalRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.select();
  const succeeded = document.execCommand('copy');

  document.body.removeChild(textarea);
  if (originalRange && selection) {
    selection.removeAllRanges();
    selection.addRange(originalRange);
  }

  if (!succeeded) {
    throw new Error('Unable to copy text');
  }
};

const resetCopiedState = () => {
  copied.value = false;
  resetTimer = undefined;
};

const copyLink = async () => {
  const link = href.value;
  if (!link || copying.value) {
    return;
  }

  copying.value = true;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(link);
    } else {
      fallbackCopy(link);
    }

    copied.value = true;
    emit('copied', link);

    if (typeof window !== 'undefined') {
      if (resetTimer) {
        window.clearTimeout(resetTimer);
      }
      resetTimer = window.setTimeout(resetCopiedState, 2500);
    }
  } catch (error) {
    emit('copy-error', error);
  } finally {
    copying.value = false;
  }
};

onBeforeUnmount(() => {
  if (resetTimer && typeof window !== 'undefined') {
    window.clearTimeout(resetTimer);
  }
});
</script>

<template>
  <div class="flex flex-col gap-1 py-4">
    <button
      type="button"
      class="inline-flex items-center gap-2 text-sm text-black hover:text-neutral-600 dark:text-white dark:hover:text-neutral-300"
      @click="copyLink"
      :aria-busy="copying"
    >
      <Icon :icon="iconName" class="text-lg" />
      <span>{{ copyLabel }}</span>
    </button>

    <div
      v-if="copied"
      class="w-fit bg-neutral-300 dark:bg-neutral-600 dark:text-white text-xs px-2 py-1"
      role="status"
    >
      {{ copiedLabel }}
    </div>
  </div>
</template>

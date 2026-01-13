<script setup lang="ts">
import { Icon } from '@iconify/vue';

withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
  }>(),
  {
    title: 'All done',
    subtitle: 'You\'ve reached the end of the feed.',
  }
);

const emit = defineEmits<{
  (e: 'restart'): void;
  (e: 'back'): void;
}>();
</script>

<template>
  <div class="h-full w-full bg-black flex items-center justify-center px-6">
    <div class="text-center">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
        <Icon icon="carbon:checkmark-filled" width="28" height="28" class="text-white" />
      </div>

      <div class="mt-4 text-lg font-semibold text-white">
        {{ title }}
      </div>
      <div class="mt-1 text-sm text-white/60">
        {{ subtitle }}
      </div>

      <div class="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          class="rounded-lg bg-white/10 px-4 py-2 text-sm text-white ring-1 ring-white/15 hover:bg-white/15"
          @click="emit('back')"
        >
          Back
        </button>

        <button
          type="button"
          class="rounded-lg bg-white px-4 py-2 text-sm text-black hover:bg-white/90"
          @click="emit('restart')"
        >
          Restart
        </button>
      </div>

      <div class="mt-4 text-xs text-white/40">
        Swipe down to return to the last clip.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useTurnstile } from '@/composables/useTurnstile';

const props = defineProps<{
  label?: string;
  helperText?: string;
  token?: string;
  required?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:token', value: string): void;
  (e: 'update:required', value: boolean): void;
}>();

const { shouldRenderTurnstile, turnstileToken, turnstileContainer } = useTurnstile();

watch(
  () => shouldRenderTurnstile.value,
  (value) => {
    emit('update:required', value);
  },
  { immediate: true },
);

watch(
  () => turnstileToken.value,
  (value) => {
    emit('update:token', value);
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="shouldRenderTurnstile" class="space-y-2">
    <label class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
      {{ props.label ?? 'Verification' }}
    </label>
    <div ref="turnstileContainer" class="w-full max-w-sm"></div>
    <p class="text-xs text-neutral-500 dark:text-neutral-400">
      {{ props.helperText ?? 'Protected by Cloudflare Turnstile.' }}
    </p>
  </div>
</template>

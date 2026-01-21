<script setup lang="ts">
import { computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useTypewriter } from '@/composables/useTypewriter';

const props = withDefaults(
  defineProps<{ collapsible?: boolean; collapsed?: boolean }>(),
  {
    collapsible: false,
    collapsed: false,
  }
);

const emit = defineEmits<{ (e: 'toggle'): void }>();

const bullets = [
  'Keep your hips square when accelerating through contact.',
  'Scan earlier before receiving the ball to identify space.',
  'Stay connected in defense to close inside channels, dont get beat on inside shoulder.',
  'Drive legs in tackles, stay in the fight to win the gain line.',
];

const {
  value: typedText,
  typing,
  typeText,
} = useTypewriter();

const typedBullets = computed(() =>
  typedText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
);

const displayBullets = computed(() => {
  if (typing.value && typedBullets.value.length > 0) {
    return typedBullets.value;
  }
  return bullets;
});

watch(
  () => bullets,
  (next) => {
    if (!next || next.length === 0) {
      typedText.value = '';
      return;
    }
    void typeText(next.join('\n'), 18);
  },
  { immediate: true }
);
</script>

<template>
  <div class="max-w-3xl rounded-lg border border-violet-400/25 bg-violet-500/5 p-3 shadow-[0_0_24px_rgba(139,92,246,0.16)]">
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-2 min-w-0">
        <Icon icon="carbon:ai-generate" width="16" height="16" class="text-violet-200 mt-0.5" />
        <div class="min-w-0">
          <div class="text-sm font-semibold text-white truncate">Key Work-ons</div>
          <div class="text-xs text-white/60">
            Based on your recent matches and coach narration.
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="text-xs text-violet-200 hover:text-violet-100 disabled:opacity-50 disabled:line-through"
          disabled
        >
          Regenerate
        </button>
        <button
          v-if="props.collapsible"
          type="button"
          class="text-xs text-white/60 hover:text-white"
          @click="emit('toggle')"
        >
          <Icon :icon="props.collapsed ? 'carbon:chevron-down' : 'carbon:chevron-up'" width="16" height="16" />
        </button>
      </div>
    </div>

    <div v-if="props.collapsible && props.collapsed" class="mt-2 text-xs text-white/50">
      Work-ons collapsed.
    </div>

    <div v-else class="mt-3">
      <ul class="space-y-1 text-sm text-white/90">
        <li v-for="(item, idx) in displayBullets" :key="idx" class="flex gap-2">
          <span class="text-violet-200">•</span>
          <span class="leading-snug">{{ item }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

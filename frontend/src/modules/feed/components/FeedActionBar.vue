<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    actions?: string[];
  }>(),
  {
    actions: () => ['That\'s me', 'Scrum', 'Tackle', 'Lineout', 'Kick'],
  }
);

const active = ref(new Set<string>());
const actionList = computed(() => props.actions ?? []);

function toggle(label: string) {
  if (active.value.has(label)) active.value.delete(label);
  else active.value.add(label);
  // Extension point: emit to backend tagging service later.
}

function isOn(label: string): boolean {
  return active.value.has(label);
}
</script>

<template>
  <div class="px-4 pt-3">
    <div class="flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="label in actionList"
        :key="label"
        type="button"
        class="shrink-0 rounded-full px-3 py-1 text-xs ring-1 transition"
        :class="isOn(label)
          ? 'bg-white/15 text-white ring-white/20'
          : 'bg-white/5 text-white/80 ring-white/10 hover:bg-white/10'"
        @click="toggle(label)"
      >
        {{ label }}
      </button>
    </div>
  </div>
</template>

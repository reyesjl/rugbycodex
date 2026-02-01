<script setup lang="ts">
import { Icon } from '@iconify/vue';
import type { ViewContext } from '../types/ViewContext';

interface Props {
  currentContext: ViewContext;
  canSwitch: boolean;
}

interface Emits {
  (e: 'switch', context: ViewContext): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const toggleContext = () => {
  const newContext: ViewContext = props.currentContext === 'player' ? 'manager' : 'player';
  emit('switch', newContext);
};
</script>

<template>
  <div v-if="canSwitch" class="inline-flex items-center gap-2 text-sm">
    <!-- Current context display -->
    <div class="flex items-center gap-1.5 text-white/60">
      <Icon 
        :icon="currentContext === 'player' ? 'carbon:user' : 'carbon:user-multiple'" 
        width="16" 
      />
      <span>Viewing as {{ currentContext === 'player' ? 'Player' : 'Manager' }}</span>
    </div>

    <!-- Switch button -->
    <button
      @click="toggleContext"
      class="flex items-center gap-1 px-2 py-1 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
    >
      <Icon icon="carbon:arrows-horizontal" width="14" />
      <span>Switch to {{ currentContext === 'player' ? 'Manager' : 'Player' }}</span>
    </button>
  </div>
</template>

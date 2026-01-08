<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
  canManage: boolean;
  hasSelection: boolean;
  selectedCount: number;
  loading?: boolean;
  orgId: string | null;
}>();

const emit = defineEmits<{
  promote: [];
  demote: [];
  remove: [];
}>();
</script>

<template>
  <div>
    <!-- Selection control bar -->
    <div
      v-if="canManage && hasSelection"
      class="flex md:flex-row flex-col md:items-center gap-2 justify-between py-2 border-t border-white/20 mb-6"
    >
      <div>
        <p class="text-sm text-white/70">
          {{ selectedCount }} member(s) selected
        </p>
      </div>
      <div class="flex gap-2 items-center">
        <button
          type="button"
          class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-sky-500 bg-sky-500/70 hover:bg-sky-700/70 text-xs transition"
          @click="emit('promote')"
        >
          <Icon icon="carbon:arrow-up" width="15" height="15" />
          Promote
        </button>
        <button
          type="button"
          class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-sky-500 bg-sky-500/70 hover:bg-sky-700/70 text-xs transition"
          @click="emit('demote')"
        >
          <Icon icon="carbon:arrow-down" width="15" height="15" />
          Demote
        </button>
        <button
          type="button"
          class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-red-500 bg-red-500/70 hover:bg-red-700/70 text-xs transition"
          @click="emit('remove')"
        >
          <Icon icon="carbon:trash-can" width="15" height="15" />
          Remove
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* intentionally empty: swiss-style = let spacing + type do the work */
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import type { FeedAssignment } from '@/modules/feed/services/assignmentService';

const props = defineProps<{
  assignment: FeedAssignment;
  completed?: boolean;
  metaLine?: string;
  onClick?: () => void;
}>();

const isCompleted = computed(() => props.completed ?? false);
</script>

<template>
  <button
    type="button"
    class="relative shrink-0 w-44 h-28 rounded-lg overflow-hidden bg-white/10 ring-1 ring-white/10 transition hover:bg-white/15 hover:ring-white/20"
    :class="isCompleted ? 'opacity-50' : ''"
    @click="props.onClick?.()"
  >
    <!-- Thumbnail placeholder -->
    <div class="absolute inset-0 bg-linear-to-br from-white/10 to-white/5" />

    <!-- Title overlay -->
    <div class="absolute inset-x-0 bottom-0 px-3 pb-2 pt-6 bg-linear-to-t from-black/60 to-transparent">
      <div class="text-sm text-white leading-snug line-clamp-1">
        {{ props.assignment.title || 'Untitled assignment' }}
      </div>
      <div v-if="props.metaLine" class="mt-0.5 text-xs text-white/60 line-clamp-1">
        {{ props.metaLine }}
      </div>
    </div>

    <!-- Completion overlay -->
    <div v-if="isCompleted" class="absolute inset-0 bg-black/25" />
    <div v-if="isCompleted" class="absolute inset-0 flex items-center justify-center">
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
        <Icon icon="carbon:checkmark-filled" class="h-6 w-6 text-white" />
      </div>
    </div>
  </button>
</template>

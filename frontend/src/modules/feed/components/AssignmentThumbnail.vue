<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import type { FeedAssignment } from '@/modules/assignments/types';

const props = defineProps<{
  assignment: FeedAssignment;
  completed?: boolean;
  thumbnailUrl?: string | null;
  onClick?: () => void;
}>();

const isCompleted = computed(() => props.completed ?? false);

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function dayDiffFromToday(target: Date): number {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / msPerDay);
}

function pluralizeDays(value: number): string {
  return value === 1 ? 'day' : 'days';
}

function formatDueRelative(date: Date): string {
  const diff = dayDiffFromToday(date);
  if (diff === 0) return 'Due today';
  if (diff > 0) return `Due in ${diff} ${pluralizeDays(diff)}`;
  const abs = Math.abs(diff);
  return `Due ${abs} ${pluralizeDays(abs)} ago`;
}

function formatCompletedRelative(date: Date): string {
  const diff = dayDiffFromToday(date);
  if (diff === 0) return 'Completed today';
  if (diff > 0) return `Completed in ${diff} ${pluralizeDays(diff)}`;
  const abs = Math.abs(diff);
  return `Completed ${abs} ${pluralizeDays(abs)} ago`;
}

const titleLine = computed(() => props.assignment.title || 'Clip review');
const metaLine = computed(() => {
  if (isCompleted.value && props.assignment.completed_at) {
    const completedAt = new Date(props.assignment.completed_at);
    if (!Number.isNaN(completedAt.getTime())) {
      return `Reviewed: ${formatDate(completedAt)} - ${formatCompletedRelative(completedAt)}`;
    }
  }
  if (isCompleted.value) {
    return 'Reviewed';
  }
  if (props.assignment.due_at) {
    const dueAt = new Date(props.assignment.due_at);
    if (!Number.isNaN(dueAt.getTime())) {
      return `Due: ${formatDate(dueAt)} - ${formatDueRelative(dueAt)}`;
    }
  }
  return '';
});
</script>

<template>
  <div
    class="shrink-0 w-64 md:w-72 transition snap-start hover:cursor-pointer"
    :class="isCompleted ? 'opacity-45' : 'hover:opacity-90'"
    @click="props.onClick?.()"
  >
    <div class="relative h-36 md:h-40 rounded-lg overflow-hidden bg-white/5">
      <!-- Thumbnail -->
      <img
        v-if="props.thumbnailUrl"
        :src="props.thumbnailUrl"
        :alt="titleLine"
        loading="lazy"
        class="absolute inset-0 h-full w-full object-cover"
      />
      <div class="absolute inset-0 bg-linear-to-br from-white/15 via-white/5 to-black/10" />

      <!-- Completion overlay -->
      <div v-if="isCompleted" class="absolute inset-0 bg-black/35" />
      <div v-if="isCompleted" class="absolute inset-0 flex items-center justify-center">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
          <Icon icon="carbon:checkmark-filled" class="h-6 w-6 text-white" />
        </div>
      </div>
    </div>

    <div class="mt-3 px-1">
      <div class="text-sm md:text-base text-white leading-snug line-clamp-1">
        {{ titleLine }}
      </div>
      <div v-if="metaLine" class="mt-1 text-xs text-white/50 line-clamp-1">
        {{ metaLine }}
      </div>
    </div>
  </div>
</template>

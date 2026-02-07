<script setup lang="ts">
import { Icon } from '@iconify/vue';
import type { ActivityEvent } from '@/modules/admin/types';

interface Props {
  activities: ActivityEvent[];
  loading?: boolean;
}

withDefaults(defineProps<Props>(), {
  loading: false,
});

const getEventIcon = (type: string) => {
  switch (type) {
    case 'org_created':
      return 'carbon:add';
    case 'media_uploaded':
      return 'carbon:cloud-upload';
    case 'narration_generated':
      return 'carbon:microphone';
    case 'job_completed':
      return 'carbon:checkmark';
    case 'job_failed':
      return 'carbon:warning-alt';
    default:
      return 'carbon:information';
  }
};

const getEventColor = (type: string) => {
  switch (type) {
    case 'org_created':
      return 'text-blue-400';
    case 'media_uploaded':
      return 'text-green-400';
    case 'narration_generated':
      return 'text-purple-400';
    case 'job_completed':
      return 'text-emerald-400';
    case 'job_failed':
      return 'text-red-400';
    default:
      return 'text-white/40';
  }
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) {
    return 'just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
</script>

<template>
  <div class="rounded-lg border border-white/10 bg-white/5 p-4">
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-white">Recent Activity</h3>
      <p class="text-xs text-white/60">Platform events feed</p>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="h-14 animate-pulse rounded bg-white/5"></div>
    </div>

    <div v-else-if="activities.length === 0" class="py-8 text-center">
      <Icon icon="carbon:activity" class="mx-auto h-8 w-8 text-white/30" />
      <p class="mt-2 text-sm text-white/60">No recent activity</p>
    </div>

    <div v-else class="space-y-1 max-h-[600px] overflow-y-auto">
      <div
        v-for="event in activities"
        :key="event.id"
        class="rounded-lg p-3 transition-colors hover:bg-white/5"
      >
        <div class="flex items-start gap-3">
          <Icon 
            :icon="getEventIcon(event.type)" 
            class="mt-0.5 h-4 w-4 flex-shrink-0" 
            :class="getEventColor(event.type)"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="text-sm text-white">
                  {{ event.title }}
                </div>
                <div v-if="event.subtitle" class="mt-0.5 text-xs text-white/60">
                  {{ event.subtitle }}
                </div>
              </div>
              <div class="text-xs text-white/40 whitespace-nowrap">
                {{ formatTimestamp(event.timestamp) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

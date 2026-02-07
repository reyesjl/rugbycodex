<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed } from 'vue';
import type { AdminDashboardAttentionItems, AttentionItem } from '@/modules/admin/types';

interface Props {
  attentionItems: AdminDashboardAttentionItems;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const allItems = computed<AttentionItem[]>(() => {
  return [
    ...props.attentionItems.failedJobs,
    ...props.attentionItems.processingFailures,
  ].sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });
});

const getItemIcon = (category: string) => {
  switch (category) {
    case 'job_failure':
      return 'carbon:warning-alt';
    case 'processing_failure':
      return 'carbon:error';
    default:
      return 'carbon:information';
  }
};

const getItemTitle = (item: AttentionItem) => {
  if (item.category === 'job_failure') {
    return `Job Failed: ${item.type || 'Unknown'}`;
  }
  if (item.category === 'processing_failure') {
    return `Processing Failed: ${item.fileName || 'Unknown'}`;
  }
  return 'Attention Required';
};

const getItemSubtitle = (item: AttentionItem) => {
  return item.errorMessage || item.stage || 'No details available';
};

const formatTimestamp = (item: AttentionItem) => {
  const dateStr = item.updatedAt || item.createdAt;
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
</script>

<template>
  <div class="rounded-lg border border-white/10 bg-white/5 p-4">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h3 class="text-sm font-semibold text-white">Needs Attention</h3>
        <p class="text-xs text-white/60">Recent failures and issues</p>
      </div>
      <div v-if="!loading && allItems.length > 0" 
        class="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">
        {{ allItems.length }}
      </div>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded bg-white/5"></div>
    </div>

    <div v-else-if="allItems.length === 0" class="py-8 text-center">
      <Icon icon="carbon:checkmark" class="mx-auto h-8 w-8 text-emerald-500/50" />
      <p class="mt-2 text-sm text-white/60">All clear! No issues detected.</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="item in allItems"
        :key="item.id"
        class="rounded-lg border border-red-500/20 bg-red-500/5 p-3 transition-colors hover:bg-red-500/10"
      >
        <div class="flex items-start gap-3">
          <Icon 
            :icon="getItemIcon(item.category)" 
            class="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" 
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-white">
                  {{ getItemTitle(item) }}
                </div>
                <div class="mt-0.5 text-xs text-white/60 line-clamp-1">
                  {{ getItemSubtitle(item) }}
                </div>
              </div>
              <div class="text-xs text-white/40 whitespace-nowrap">
                {{ formatTimestamp(item) }}
              </div>
            </div>
            <div class="mt-1 text-xs text-white/50">
              {{ item.orgName }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

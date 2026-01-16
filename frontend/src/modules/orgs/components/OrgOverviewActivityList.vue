<script setup lang="ts">
import { Icon } from '@iconify/vue';
import type { RouteLocationRaw } from 'vue-router';

type RecentSignalItem = {
  id: string;
  label: string;
  timeLabel: string;
  typeLabel: string;
  icon: string;
  to: RouteLocationRaw;
};

defineProps<{
  items: RecentSignalItem[];
  isLoading?: boolean;
}>();

const typeTone = (typeLabel: string) => {
  switch (typeLabel.toLowerCase()) {
    case 'assignment':
      return { label: 'text-white/60', icon: 'text-white/80' };
    case 'narration':
      return { label: 'text-white/50', icon: 'text-white/70' };
    case 'media':
      return { label: 'text-white/45', icon: 'text-white/60' };
    default:
      return { label: 'text-white/45', icon: 'text-white/60' };
  }
};

const listItemClass = (index: number) => [
  'group flex items-start gap-3 pb-3 text-white/70 transition hover:text-white',
  index === 0 ? '' : 'border-t border-white/5 pt-3',
];
</script>

<template>
  <section class="space-y-4 rounded-lg border border-white/5 bg-white/[0.03] p-4">
    <div>
      <p class="text-[10px] uppercase tracking-[0.3em] text-white/35">Recent Signals</p>
      <h2 class="text-sm font-semibold text-white/90">Latest Signals</h2>
    </div>

    <div v-if="isLoading" class="text-sm text-white/50">Loading signals...</div>

    <div v-else>
      <div v-if="items.length" class="space-y-0.5">
        <RouterLink
          v-for="(item, index) in items"
          :key="item.id"
          :to="item.to"
          :class="listItemClass(index)"
        >
          <span class="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/5">
            <Icon :icon="item.icon" class="h-3.5 w-3.5" :class="typeTone(item.typeLabel).icon" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-[9px] uppercase tracking-[0.2em]" :class="typeTone(item.typeLabel).label">
              {{ item.typeLabel }}
            </div>
            <div class="mt-1 truncate text-[13px] font-medium text-white/90">{{ item.label }}</div>
          </div>
          <span class="shrink-0 text-[10px] text-white/35">{{ item.timeLabel }}</span>
        </RouterLink>
      </div>
      <p v-else class="text-sm text-white/50">No signals logged yet.</p>
    </div>
  </section>
</template>

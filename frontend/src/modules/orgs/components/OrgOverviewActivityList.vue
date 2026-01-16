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
  'group flex items-start gap-4 pb-4 transition hover:text-white',
  index === 0 ? '' : 'border-t border-white/5 pt-4',
  (index + 1) % 4 === 0 ? 'pt-6' : '',
];
</script>

<template>
  <section class="space-y-5 border-t border-white/10 pt-7">
    <div>
      <p class="text-[11px] uppercase tracking-[0.3em] text-white/40">What happened</p>
      <h2 class="text-xl font-semibold text-white">Recent Signals</h2>
      <p class="mt-1 text-xs text-white/45">What happened and what was said, in time order.</p>
    </div>

    <div v-if="isLoading" class="text-sm text-white/50">Loading signals...</div>

    <div v-else>
      <div v-if="items.length">
        <RouterLink
          v-for="(item, index) in items"
          :key="item.id"
          :to="item.to"
          :class="listItemClass(index)"
        >
          <span class="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/5">
            <Icon :icon="item.icon" class="h-4 w-4" :class="typeTone(item.typeLabel).icon" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-[10px] uppercase tracking-[0.2em]" :class="typeTone(item.typeLabel).label">
              {{ item.typeLabel }}
            </div>
            <div class="mt-1 text-sm font-semibold text-white">{{ item.label }}</div>
          </div>
          <span class="shrink-0 text-[11px] text-white/35">{{ item.timeLabel }}</span>
        </RouterLink>
      </div>
      <p v-else class="text-sm text-white/50">No signals logged yet.</p>
    </div>
  </section>
</template>

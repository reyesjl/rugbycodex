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
</script>

<template>
  <section class="space-y-4">
    <div>
      <p class="text-[11px] uppercase tracking-[0.3em] text-white/40">What happened</p>
      <h2 class="text-lg font-semibold text-white">Recent Signals</h2>
      <p class="mt-1 text-xs text-white/50">What happened and what was said, in time order.</p>
    </div>

    <div v-if="isLoading" class="text-sm text-white/50">Loading signals...</div>

    <div v-else>
      <div v-if="items.length" class="divide-y divide-white/10">
        <RouterLink
          v-for="item in items"
          :key="item.id"
          :to="item.to"
          class="group flex items-start gap-3 py-3 transition hover:text-white"
        >
          <span class="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70">
            <Icon :icon="item.icon" class="h-4 w-4" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-[10px] uppercase tracking-[0.2em] text-white/40">{{ item.typeLabel }}</div>
            <div class="mt-1 text-sm text-white">{{ item.label }}</div>
          </div>
          <span class="text-[11px] text-white/40">{{ item.timeLabel }}</span>
        </RouterLink>
      </div>
      <p v-else class="text-sm text-white/50">No signals logged yet.</p>
    </div>
  </section>
</template>

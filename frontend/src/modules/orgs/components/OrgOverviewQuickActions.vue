<script setup lang="ts">
import { Icon } from '@iconify/vue';
import type { RouteLocationRaw } from 'vue-router';

type QuickAction = {
  id: string;
  label: string;
  description?: string;
  icon: string;
  to: RouteLocationRaw;
};

defineProps<{
  actions: QuickAction[];
}>();
</script>

<template>
  <section class="space-y-3 border-t border-white/5 pt-4">
    <div class="flex items-center justify-between">
      <h2 class="text-[10px] uppercase tracking-[0.32em] text-white/45">Quick Actions</h2>
      <div class="text-[10px] text-white/30">Immediate</div>
    </div>

    <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
      <RouterLink
        v-for="action in actions"
        :key="action.id"
        :to="action.to"
        class="group flex items-center gap-3 rounded-md px-3 py-2 text-white/70 transition hover:bg-white/5 hover:text-white"
      >
        <span class="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-white/60">
          <Icon :icon="action.icon" class="h-4 w-4" />
        </span>
        <div class="min-w-0">
          <div class="text-[13px] font-medium text-white/90">{{ action.label }}</div>
          <div v-if="action.description" class="text-[11px] text-white/40">{{ action.description }}</div>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';

type QuickAction = {
  id: string;
  label: string;
  description?: string;
  to: RouteLocationRaw;
};

defineProps<{
  actions: QuickAction[];
}>();
</script>

<template>
  <section class="space-y-3 border-t border-white/10 pt-4">
    <div class="flex items-center justify-between">
      <h2 class="text-[11px] uppercase tracking-[0.3em] text-white/40">Quick Actions</h2>
      <div class="text-[11px] text-white/30">Utility</div>
    </div>

    <div class="space-y-2">
      <RouterLink
        v-for="action in actions"
        :key="action.id"
        :to="action.to"
        class="flex flex-col gap-1 rounded-md px-3 py-2 text-white/70 transition hover:bg-white/5 hover:text-white"
      >
        <span class="text-sm">{{ action.label }}</span>
        <span v-if="action.description" class="text-xs text-white/40">{{ action.description }}</span>
      </RouterLink>
    </div>
  </section>
</template>

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
  <section class="rounded-xl border border-white/10 bg-black/40 p-5">
    <div class="flex items-center justify-between">
      <h2 class="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Quick Actions</h2>
      <div class="text-[11px] text-white/40">Manage operations</div>
    </div>

    <div class="mt-4 space-y-2">
      <RouterLink
        v-for="action in actions"
        :key="action.id"
        :to="action.to"
        class="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 p-3 transition hover:border-white/20 hover:bg-white/10"
      >
        <span class="text-sm text-white">{{ action.label }}</span>
        <span v-if="action.description" class="text-xs text-white/50">{{ action.description }}</span>
      </RouterLink>
    </div>
  </section>
</template>

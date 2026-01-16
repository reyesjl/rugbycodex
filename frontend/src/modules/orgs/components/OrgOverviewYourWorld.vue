<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';

type SignalItem = {
  id: string;
  title: string;
  meta?: string;
  status?: string;
  tag?: string;
  to?: RouteLocationRaw;
};

defineProps<{
  title: string;
  description?: string;
  eyebrow?: string;
  items: SignalItem[];
  isLoading?: boolean;
  emptyLabel?: string;
}>();
</script>

<template>
  <section class="space-y-4">
    <div>
      <p v-if="eyebrow" class="text-[11px] uppercase tracking-[0.3em] text-white/40">{{ eyebrow }}</p>
      <h2 class="text-lg font-semibold text-white">{{ title }}</h2>
      <p v-if="description" class="mt-1 text-xs text-white/50">{{ description }}</p>
    </div>

    <div v-if="isLoading" class="text-sm text-white/50">Loading context...</div>

    <div v-else>
      <div v-if="items.length" class="divide-y divide-white/10">
        <div v-for="item in items" :key="item.id" class="py-3">
          <RouterLink
            v-if="item.to"
            :to="item.to"
            class="group flex items-start justify-between gap-4 transition hover:text-white"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                <span v-if="item.tag">{{ item.tag }}</span>
                <span v-if="item.status" class="text-white/50">{{ item.status }}</span>
              </div>
              <div class="mt-1 text-sm text-white">{{ item.title }}</div>
              <div v-if="item.meta" class="mt-1 text-xs text-white/50">{{ item.meta }}</div>
            </div>
          </RouterLink>
          <div v-else class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                <span v-if="item.tag">{{ item.tag }}</span>
                <span v-if="item.status" class="text-white/50">{{ item.status }}</span>
              </div>
              <div class="mt-1 text-sm text-white">{{ item.title }}</div>
              <div v-if="item.meta" class="mt-1 text-xs text-white/50">{{ item.meta }}</div>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="text-sm text-white/50">{{ emptyLabel ?? 'No items logged yet.' }}</p>
    </div>
  </section>
</template>

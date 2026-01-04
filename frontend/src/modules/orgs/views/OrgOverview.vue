<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { formatMonthYear } from '@/lib/date';
import { useActiveOrganizationStore } from '../stores/useActiveOrganizationStore';

const activeOrganizationStore = useActiveOrganizationStore();
const { active, resolving } = storeToRefs(activeOrganizationStore);

const org = computed(() => active.value?.organization ?? null);

const badgeClass =
  'rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50';

</script>

<template>
  <section class="container pt-6 text-white">
    <div v-if="resolving" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Loading organization…
    </div>

    <div v-else-if="!org" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Organization unavailable.
    </div>

    <div v-else class="space-y-4">
      <header class="space-y-2">
        <div class="flex flex-col gap-2 md:flex-row md:items-center">
          <h1 class="text-3xl">{{ org.name }}</h1>
          <div class="flex flex-wrap gap-2">
            <span :class="badgeClass">{{ org.visibility ?? 'unknown' }}</span>
          </div>
        </div>

        <p class="text-xs text-gray-500">Joined on {{ formatMonthYear(org.created_at) ?? 'Unknown' }}</p>

        <p class="max-w-2xl text-white/70">
          {{ org.bio && org.bio.trim().length ? org.bio : 'No bio yet.' }}
        </p>
      </header>
    </div>
  </section>
</template>

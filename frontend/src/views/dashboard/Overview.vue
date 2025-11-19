<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const narrationCount = computed(() => 0);
const displayName = computed(() => {
  const metadataName = authStore.user?.user_metadata?.name as string | undefined;
  if (metadataName?.trim()) return metadataName;
  return authStore.user?.email ?? 'Rugbycodex Member';
});
</script>

<template>
  <section class="space-y-6">
    <article class="rounded-2xl border border-neutral-200 bg-neutral-50/90 p-6 text-neutral-900 shadow-[0_10px_30px_rgba(0,0,0,0.05)] dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-100 dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <p class="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Narrations
      </p>
      <div class="mt-4 text-5xl font-semibold">
        {{ narrationCount }}
      </div>
      <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Narrations created by {{ displayName }}.
      </p>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from 'vue';
import { useRoute } from 'vue-router';
import { insideEntries } from '@/data/inside';

const route = useRoute();

const articleModules = import.meta.glob<{ default: Component }>(
  '../data/inside/articles/*.vue'
);

const slug = computed(() => route.params.slug as string | undefined);


const entry = computed(() => {
  if (!slug.value) {
    return undefined;
  }
  return insideEntries.find((item) => item.slug === slug.value);
});

const articleComponent = computed<Component | null>(() => {
  const currentEntry = entry.value;
  if (!currentEntry) {
    return null;
  }

  const modulePath = `../data/inside/articles/${currentEntry.slug}.vue`;
  const loader = articleModules[modulePath];

  if (!loader) {
    return null;
  }

  return defineAsyncComponent(() => loader().then((module) => module.default));
});
</script>

<template>
  <section class="container-sm mx-auto max-w-3xl py-20 text-neutral-900 dark:text-neutral-100">
    <component
      v-if="articleComponent && entry"
      :is="articleComponent"
      :entry="entry"
    />
    <div v-else class="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight">Article not found</h1>
        <p class="text-neutral-500 dark:text-neutral-400">
          We could not find this Inside article. Please check the link or return to the Inside the Codex index.
        </p>
      </div>
    </div>
  </section>
</template>

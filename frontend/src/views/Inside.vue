<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
// import { Icon } from '@iconify/vue';
import { useRouter } from 'vue-router';
import { insideEntries, type EntryTag, type InsideEntry } from '@/data/inside';

const filters = ['All', 'Publication', 'Milestone', 'Release'] as const;
type Filter = (typeof filters)[number];

const activeClasses = 'border-b-2 border-neutral-900 text-neutral-900 dark:border-white dark:text-white';
const inactiveClasses = 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-neutral-300';

const activeFilter = ref<Filter>('All');

const layoutOptions = [
  { icon: 'carbon:list-boxes', label: 'Grid' },
  { icon: 'carbon:list', label: 'List' },
] as const;

const entries = ref<InsideEntry[]>([]);
const router = useRouter();

const fetchInsideEntries = async (): Promise<InsideEntry[]> => {
  // TODO: Replace with API call once backend endpoint is available.
  return insideEntries;
};

const loadEntries = async () => {
  entries.value = await fetchInsideEntries();
};

onMounted(() => {
  void loadEntries();
});

const selectFilter = (filter: Filter) => {
  activeFilter.value = filter;
};

const isEntryTag = (filter: Filter): filter is EntryTag => filter !== 'All';

const filteredEntries = computed(() => {
  const selectedFilter = activeFilter.value;
  if (!isEntryTag(selectedFilter)) {
    return entries.value;
  }
  return entries.value.filter((entry) => entry.tags.includes(selectedFilter));
});

const handleEntryClick = (entry: InsideEntry) => {
  void router.push({
    name: 'InsideArticle',
    params: { slug: entry.slug },
  });
};
</script>

<template>
  <section class="container py-28 text-neutral-900 dark:text-neutral-100">
    <header class="space-y-4">
      <div class="space-y-3">
        <h1 class="text-4xl tracking-tight md:text-6xl">Inside the Codex</h1>
        <p class="max-w-2xl text-base text-neutral-500 dark:text-neutral-400">
          Essays, release notes, and internal studies from the Rugbycodex team. These posts trace how we are building a
          shared intelligence layer for modern rugby clubs.
        </p>
      </div>
    </header>

    <div
      class="mt-10 flex flex-col gap-6 pb-10 text-base text-neutral-500 dark:border-neutral-800"
    >
      <nav class="flex flex-wrap gap-4">
        <button
          v-for="filter in filters"
          :key="filter"
          type="button"
          @click="selectFilter(filter)"
          class="pb-2 tracking-tight transition-colors cursor-pointer"
          :class="
            filter === activeFilter
              ? activeClasses
              : inactiveClasses
          "
        >
          {{ filter }}
        </button>
      </nav>
      <!-- <div class="flex flex-wrap items-center gap-6 text-xs uppercase tracking-tight text-neutral-500">
        <span class="inline-flex items-center gap-2">
          <Icon icon="carbon:filter" class="h-4 w-4" />
          Filter
        </span>
        <span class="inline-flex items-center gap-2">
          <Icon icon="carbon:sort-descending" class="h-4 w-4" />
          Sort
        </span>
        <div class="ml-auto flex items-center gap-2 text-neutral-400">
          <button
            v-for="option in layoutOptions"
            :key="option.icon"
            type="button"
            class="rounded-full border border-transparent p-2 transition hover:text-neutral-900 dark:hover:text-neutral-100"
            :class="option.icon === layoutOptions[1].icon ? 'text-neutral-900 dark:text-neutral-100' : ''"
            :title="option.label"
          >
            <Icon :icon="option.icon" class="h-4 w-4" />
          </button>
        </div>
      </div> -->
    </div>

    <div class="mt-6 py-4">
      <article
        v-for="(entry, index) in filteredEntries"
        :key="entry.title"
        class="flex cursor-pointer flex-col gap-6 border-b border-b-neutral-200/80 py-8 transition-[border-color] hover:border-b-neutral-900 focus-visible:border-b-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 first:border-t first:border-t-neutral-200/80 dark:border-b-neutral-800 dark:hover:border-b-white dark:focus-visible:border-b-white dark:focus-visible:ring-white dark:first:border-t-neutral-800 md:flex-row md:items-start md:gap-12"
        role="button"
        tabindex="0"
        @click="handleEntryClick(entry)"
        @keydown.enter.prevent="handleEntryClick(entry)"
        @keydown.space.prevent="handleEntryClick(entry)"
      >
        <div class="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400 md:w-48 md:flex-col md:items-start md:gap-1">
          <span class="font-medium tracking-tight text-neutral-900 dark:text-neutral-200">
            {{ entry.tags[0] }}
          </span>
          <span>{{ entry.date }}</span>
        </div>
        <div class="flex-1 space-y-3">
          <div class="space-y-2">
            <h2 class="text-xl tracking-tight text-neutral-900 dark:text-white">
              {{ entry.title }}
            </h2>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              {{ entry.summary }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
            <span>{{ entry.readingTime }}</span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

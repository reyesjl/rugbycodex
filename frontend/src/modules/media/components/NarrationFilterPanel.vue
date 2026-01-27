<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import type { NarrationSourceType } from '@/modules/narrations/types/Narration';
import type { SegmentTagType } from '@/modules/media/types/SegmentTag';

type SourceFilter = 'all' | NarrationSourceType;
type TagFilterOption = { key: string; type: SegmentTagType | null };

const props = defineProps<{
  selectedSource: SourceFilter;
  activeTagFilters: string[];
  tagFilterOptions: TagFilterOption[];
  showEmptyOnly: boolean;
  searchQuery: string;
  searchLoading?: boolean;
  searchError?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:selectedSource', value: SourceFilter): void;
  (e: 'update:showEmptyOnly', value: boolean): void;
  (e: 'update:searchQuery', value: string): void;
  (e: 'toggleTagFilter', tagKey: string): void;
  (e: 'clearTagFilters'): void;
}>();

const SOURCE_FILTERS: Array<{ value: SourceFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'coach', label: 'Coach' },
  { value: 'staff', label: 'Staff' },
  { value: 'member', label: 'Member' },
];

const tagFiltersExpanded = ref(false);
const tagFilterScrollEl = ref<HTMLElement | null>(null);

const hasActiveTagFilters = computed(() => props.activeTagFilters.length > 0);

function formatTagLabel(tagKey: string): string {
  return String(tagKey ?? '').replace(/_/g, ' ');
}

function classForTagType(tagType: SegmentTagType | null | undefined): string {
  const type = String(tagType ?? '');
  if (type === 'action') return 'bg-slate-700/50 text-slate-300';
  if (type === 'context') return 'bg-slate-700/50 text-slate-300';
  if (type === 'identity') return 'bg-slate-700/50 text-slate-300';
  return 'bg-slate-700/50 text-slate-300';
}

function scrollTagFilters(direction: 'left' | 'right') {
  const el = tagFilterScrollEl.value;
  if (!el) return;
  const amount = Math.max(160, Math.floor(el.clientWidth * 0.7));
  el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
}
</script>

<template>
  <div class="space-y-4">
    <!-- Search Bar -->
    <div class="relative">
      <Icon
        icon="carbon:search"
        width="16"
        height="16"
        class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        :value="searchQuery"
        type="search"
        placeholder="Search plays, actions, patterns…"
        class="w-full rounded-md bg-slate-900/50 border border-slate-700/50 py-2 pl-10 pr-3 text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />
      <div
        v-if="searchLoading"
        class="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border border-slate-400 border-t-slate-200"
      />
    </div>

    <div v-if="searchError" class="text-xs text-rose-300">
      {{ searchError }}
    </div>

    <!-- Source Filters -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="option in SOURCE_FILTERS"
        :key="option.value"
        type="button"
        class="text-xs font-medium transition rounded px-3 py-1.5"
        :class="selectedSource === option.value
          ? 'bg-slate-700 text-white'
          : 'text-slate-400 hover:text-slate-200'"
        @click="emit('update:selectedSource', option.value)"
      >
        {{ option.label }}
      </button>

      <button
        type="button"
        class="text-xs font-medium transition rounded px-3 py-1.5"
        :class="showEmptyOnly
          ? 'bg-slate-700 text-white'
          : 'text-slate-400 hover:text-slate-200'"
        @click="emit('update:showEmptyOnly', !showEmptyOnly)"
      >
        Empty
      </button>
    </div>

    <!-- Active Filters Strip -->
    <div v-if="hasActiveTagFilters || selectedSource !== 'all' || showEmptyOnly" class="flex items-center gap-2 flex-wrap">
      <span class="text-xs text-slate-400">Active filters:</span>
      <button
        v-if="selectedSource !== 'all'"
        type="button"
        class="inline-flex items-center gap-1 rounded bg-slate-700/50 px-2 py-1 text-xs text-slate-300"
        @click="emit('update:selectedSource', 'all')"
      >
        <span>{{ SOURCE_FILTERS.find(f => f.value === selectedSource)?.label }}</span>
        <Icon icon="carbon:close" width="12" height="12" />
      </button>
      <button
        v-if="showEmptyOnly"
        type="button"
        class="inline-flex items-center gap-1 rounded bg-slate-700/50 px-2 py-1 text-xs text-slate-300"
        @click="emit('update:showEmptyOnly', false)"
      >
        <span>Empty only</span>
        <Icon icon="carbon:close" width="12" height="12" />
      </button>
      <button
        v-for="tagKey in activeTagFilters"
        :key="tagKey"
        type="button"
        class="inline-flex items-center gap-1 rounded bg-slate-700/50 px-2 py-1 text-xs text-slate-300"
        @click="emit('toggleTagFilter', tagKey)"
      >
        <span>{{ formatTagLabel(tagKey) }}</span>
        <Icon icon="carbon:close" width="12" height="12" />
      </button>
      <button
        type="button"
        class="text-xs text-slate-400 hover:text-slate-200"
        @click="emit('clearTagFilters'); emit('update:selectedSource', 'all'); emit('update:showEmptyOnly', false)"
      >
        Clear all
      </button>
    </div>

    <!-- Tag Filters -->
    <div v-if="tagFilterOptions.length > 0" class="space-y-2">
      <button
        type="button"
        class="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
        @click="tagFiltersExpanded = !tagFiltersExpanded"
      >
        <Icon 
          :icon="tagFiltersExpanded ? 'carbon:chevron-down' : 'carbon:chevron-right'" 
          width="14" 
          height="14" 
        />
        <span>Tags</span>
        <span class="text-slate-500">({{ tagFilterOptions.length }})</span>
      </button>

      <div 
        v-if="tagFiltersExpanded" 
        ref="tagFilterScrollEl"
        class="flex items-center gap-2 flex-wrap"
      >
        <button
          v-for="tag in tagFilterOptions"
          :key="tag.key"
          type="button"
          class="text-xs font-medium uppercase tracking-wide rounded px-2 py-1 transition"
          :class="activeTagFilters.includes(tag.key)
            ? 'bg-slate-700 text-white'
            : `${classForTagType(tag.type)} hover:bg-slate-700/70`"
          @click="emit('toggleTagFilter', tag.key)"
        >
          {{ formatTagLabel(tag.key) }}
        </button>
      </div>
    </div>
  </div>
</template>

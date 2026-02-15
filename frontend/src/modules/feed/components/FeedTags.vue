<script setup lang="ts">
import { computed } from 'vue';
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue';
import type { SegmentTag } from '@/modules/media/types/SegmentTag';

const props = withDefaults(
  defineProps<{
    tags?: SegmentTag[];
    profileNameById?: Record<string, string>;
    currentUserId?: string | null;
  }>(),
  {
    tags: () => [],
    profileNameById: () => ({}),
    currentUserId: null,
  }
);

const tagList = computed(() => props.tags ?? []);

// Separate identity tags from other tags (action + context together)
const identityTags = computed(() => tagList.value.filter((tag) => tag.tag_type === 'identity'));
const otherTags = computed(() => tagList.value.filter((tag) => tag.tag_type !== 'identity'));

// Only show tabs if we have tags
const showTabs = computed(() => identityTags.value.length > 0 || otherTags.value.length > 0);

function formatTagLabel(tag: SegmentTag): string {
  const raw = String(tag.tag_key ?? '').replace(/_/g, ' ').trim();
  
  if (tag.tag_type === 'identity') {
    // Show "you" if it's the current user
    const profileId = tag.tagged_profile_id ?? tag.created_by;
    if (props.currentUserId && String(profileId) === String(props.currentUserId)) return 'you';
    
    // Show profile name if available
    const profileKey = profileId ? String(profileId) : '';
    const profileName = profileKey ? props.profileNameById?.[profileKey] : '';
    if (profileName) return profileName;
    
    // Fallback
    if (raw && raw !== 'self') return raw;
    return 'player';
  }
  
  // For action/context tags, just return the formatted key
  return raw || String(tag.tag_type ?? '').toLowerCase();
}

function classForTag(tag: SegmentTag): string {
  const type = String(tag.tag_type ?? '');
  if (type === 'action') return 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-200/20';
  if (type === 'context') return 'bg-sky-500/15 text-sky-100 ring-1 ring-sky-200/20';
  if (type === 'identity') return 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-200/20';
  return 'bg-white/10 text-white/80 ring-1 ring-white/15';
}
</script>

<template>
  <div v-if="showTabs" class="px-4 py-3">
    <TabGroup>
      <TabList class="flex gap-1 border-b border-white/10 mb-3">
        <Tab
          v-if="identityTags.length"
          v-slot="{ selected }"
          as="template"
        >
          <button
            class="px-3 py-2 text-xs uppercase tracking-wide transition focus:outline-none"
            :class="[
              selected 
                ? 'text-white font-semibold border-b-2 border-white' 
                : 'text-white/50 font-normal hover:text-white/70'
            ]"
          >
            Players
          </button>
        </Tab>
        <Tab
          v-if="otherTags.length"
          v-slot="{ selected }"
          as="template"
        >
          <button
            class="px-3 py-2 text-xs uppercase tracking-wide transition focus:outline-none"
            :class="[
              selected 
                ? 'text-white font-semibold border-b-2 border-white' 
                : 'text-white/50 font-normal hover:text-white/70'
            ]"
          >
            Tags
          </button>
        </Tab>
      </TabList>

      <TabPanels>
        <!-- Players Panel -->
        <TabPanel v-if="identityTags.length" class="flex flex-wrap gap-2 focus:outline-none">
          <div
            v-for="tag in identityTags"
            :key="String(tag.id)"
            class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide"
            :class="classForTag(tag)"
          >
            {{ formatTagLabel(tag) }}
          </div>
        </TabPanel>

        <!-- Tags Panel -->
        <TabPanel v-if="otherTags.length" class="flex flex-wrap gap-2 focus:outline-none">
          <div
            v-for="tag in otherTags"
            :key="String(tag.id)"
            class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide"
            :class="classForTag(tag)"
          >
            {{ formatTagLabel(tag) }}
          </div>
        </TabPanel>
      </TabPanels>
    </TabGroup>
  </div>
</template>

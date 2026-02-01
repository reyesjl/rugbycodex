<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useMyMoments } from '@/modules/app/composables/useMyMoments';
import { formatMediaAssetNameForDisplay } from '@/modules/media/utils/assetUtilities';
import type { SegmentTag } from '@/modules/app/services/myMomentsService';
import { Icon } from '@iconify/vue';

const {
  momentGroups,
  loading,
  error,
  isEmpty,
  loadMoments,
  navigateToMoment,
  formatTimestamp,
  formatMatchDate,
} = useMyMoments();

onMounted(() => {
  loadMoments();
});

// Track which matches are expanded
const expandedMatches = ref<Set<string>>(new Set());

function toggleMatch(mediaAssetId: string) {
  const newExpanded = new Set(expandedMatches.value);
  if (newExpanded.has(mediaAssetId)) {
    newExpanded.delete(mediaAssetId);
  } else {
    newExpanded.add(mediaAssetId);
  }
  expandedMatches.value = newExpanded;
}

function isExpanded(mediaAssetId: string): boolean {
  return expandedMatches.value.has(mediaAssetId);
}

function handleMomentClick(orgId: string, mediaAssetId: string, segmentId: string) {
  navigateToMoment(orgId, mediaAssetId, segmentId);
}

function formatSegmentDescription(tags: SegmentTag[]): string {
  const actionTags = tags.filter((t) => t.tag_type === 'action').map((t) => formatTagKey(t.tag_key));
  const contextTags = tags.filter((t) => t.tag_type === 'context').map((t) => formatTagKey(t.tag_key));

  if (actionTags.length === 0 && contextTags.length === 0) {
    return 'You in action';
  }

  const parts: string[] = [];
  
  if (actionTags.length > 0) {
    parts.push(actionTags.join(', '));
  }

  if (contextTags.length > 0) {
    parts.push(`(${contextTags.join(', ')})`);
  }

  return `You in ${parts.join(' ')}`;
}

function formatTagKey(key: string): string {
  return key.replace(/_/g, ' ');
}
</script>

<template>
  <div>
    <!-- Loading state -->
    <div v-if="loading" class="space-y-4">
      <div class="animate-pulse space-y-4">
        <div class="flex gap-4">
          <div class="h-20 w-36 bg-white/10 rounded"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-white/10 rounded w-1/2"></div>
            <div class="h-3 bg-white/10 rounded w-1/3"></div>
          </div>
        </div>
        <div class="flex gap-4">
          <div class="h-20 w-36 bg-white/10 rounded"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-white/10 rounded w-1/2"></div>
            <div class="h-3 bg-white/10 rounded w-1/3"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-xs text-red-400">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="isEmpty" class="text-xs text-white/30">
      No moments were found. Start capturing your highlights with the "That's me" button!
    </div>

    <!-- Moments accordion -->
    <div v-else class="space-y-2">
      <div
        v-for="group in momentGroups"
        :key="group.mediaAssetId"
        class="border border-white/10 rounded-lg overflow-hidden hover:border-white/20 transition-colors"
      >
        <!-- Accordion Header (clickable to expand/collapse) -->
        <button
          @click="toggleMatch(group.mediaAssetId)"
          class="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 transition-colors text-left"
        >
          <!-- Thumbnail -->
          <div
            class="w-24 h-16 shrink-0 bg-black rounded overflow-hidden"
            :class="{ 'bg-white/5': !group.thumbnailPath }"
          >
            <img
              v-if="group.thumbnailPath"
              :src="`https://cdn.rugbycodex.com/${group.thumbnailPath}`"
              :alt="group.matchName"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-white/20 text-xs">
              No preview
            </div>
          </div>

          <!-- Match info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <h3 class="font-semibold text-white truncate capitalize">{{ formatMediaAssetNameForDisplay(group.matchName) }}</h3>
              <span class="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium bg-white/10 text-white/70 rounded uppercase tracking-wide">
                {{ group.orgName }}
              </span>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <p class="text-xs text-white/50">{{ formatMatchDate(group.matchDate) }}</p>
              <span class="text-xs text-white/40">•</span>
              <p class="text-xs text-white/50">{{ group.segments.length }} moment{{ group.segments.length === 1 ? '' : 's' }}</p>
            </div>
          </div>

          <!-- Expand/Collapse Icon -->
          <div class="flex-shrink-0 text-white/60">
            <svg
              class="w-5 h-5 transition-transform"
              :class="{ 'rotate-180': isExpanded(group.mediaAssetId) }"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>

        <!-- Accordion Content (segments list) -->
        <transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="max-h-0 opacity-0"
          enter-to-class="max-h-[1000px] opacity-100"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="max-h-[1000px] opacity-100"
          leave-to-class="max-h-0 opacity-0"
        >
          <div v-if="isExpanded(group.mediaAssetId)" class="overflow-hidden">
            <div class="divide-y divide-white/5">
              <button
                v-for="segment in group.segments"
                :key="segment.segmentId"
                @click.stop="handleMomentClick(group.orgId, group.mediaAssetId, segment.segmentId)"
                class="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left group hover:cursor-pointer"
              >
                <div class="flex-shrink-0 text-xs font-mono text-white/60 group-hover:text-white/80">
                  {{ formatTimestamp(segment.startSeconds) }}
                </div>
                <div class="flex-1 text-sm text-white/70 group-hover:text-white">
                  {{ formatSegmentDescription(segment.tags) }}
                </div>
                <Icon icon="carbon:arrow-up-right" class="text-white/40 group-hover:text-white" width="16" />
              </button>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

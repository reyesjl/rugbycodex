<script setup lang="ts">
import { computed } from 'vue';
import type { FeedItem as FeedItemType } from '@/modules/feed/types/FeedItem';
import { useFeedNavigation } from '@/modules/feed/composables/useFeedNavigation';
import { useFeedPreload } from '@/modules/feed/composables/useFeedPreload';
import FeedItem from '@/modules/feed/components/FeedItem.vue';
import FeedGestureLayer from '@/modules/feed/components/FeedGestureLayer.vue';
import FeedDoneScreen from '@/modules/feed/components/FeedDoneScreen.vue';

/**
 * Owns feed list + active index.
 *
 * Responsibilities:
 * - Active index management (next/prev/setActive)
 * - Preload adjacent clips
 * - Ensure only active FeedItem plays (by passing isActive)
 */

const props = defineProps<{
  items: FeedItemType[];
  profileNameById?: Record<string, string>;
  initialSegmentId?: string;
}>();

const emit = defineEmits<{
  (e: 'watchedHalf', payload: { index: number }): void;
  (e: 'addIdentityTag', payload: { segmentId: string }): void;
  (e: 'removeIdentityTag', payload: { segmentId: string }): void;
}>();

const items = computed(() => props.items ?? []);

// Calculate initial index based on initialSegmentId if provided
const initialIndex = computed(() => {
  if (!props.initialSegmentId) return 0;
  
  const index = items.value.findIndex(
    (item) => String(item.mediaAssetSegmentId) === String(props.initialSegmentId)
  );
  
  // If segment found, use its index; otherwise default to 0
  return index >= 0 ? index : 0;
});

// Add one extra "done" page after the last clip.
const pageCount = computed(() => items.value.length + 1);

const nav = useFeedNavigation({
  length: () => pageCount.value,
  initialIndex: initialIndex.value,
});

const preload = useFeedPreload({
  items: () => items.value,
  activeIndex: () => nav.activeIndex.value,
  radius: 1,
});

function goNext() {
  nav.goNext();
}

function goPrev() {
  nav.goPrev();
}

function setActive(index: number) {
  nav.setActive(index);
}

function restart() {
  nav.setActive(0);
}

const isDone = computed(() => nav.activeIndex.value >= items.value.length);
const activeItem = computed(() => {
  if (isDone.value) return null;
  return items.value[nav.activeIndex.value] ?? null;
});

defineExpose({
  goNext,
  goPrev,
  setActive,
  activeIndex: nav.activeIndex,
});
</script>

<template>
  <!-- Mobile: fullscreen swipe paging -->
  <div class="h-full w-full overflow-hidden bg-black md:hidden">
    <div
      class="h-full w-full transition-transform duration-250 ease-out"
      :style="{ transform: `translateY(-${nav.activeIndex.value * 100}%)` }"
    >
      <div v-for="(item, index) in items" :key="item.id" class="h-full w-full">
        <FeedItem
          :feed-item="item"
          :is-active="index === nav.activeIndex.value"
          :src="preload.getSrc(item.mediaAssetId)"
          :src-error="preload.getError(item.mediaAssetId)"
          :can-prev="nav.hasPrev.value"
          :can-next="nav.hasNext.value"
          :profile-name-by-id="props.profileNameById"
          @next="goNext"
          @prev="goPrev"
          @watchedHalf="emit('watchedHalf', { index })"
          @addIdentityTag="emit('addIdentityTag', $event)"
          @removeIdentityTag="emit('removeIdentityTag', $event)"
        />
      </div>

      <!-- Final completion page (reachable by swiping up past the last clip). -->
      <div class="relative h-full w-full">
        <FeedGestureLayer @swipeDown="goPrev" @swipeUp="goNext" @tap="(_p) => {}">
          <FeedDoneScreen @back="goPrev" @restart="restart" />
        </FeedGestureLayer>
      </div>
    </div>
  </div>

  <!-- Desktop: normal page scroll; show only the active item -->
  <div class="hidden md:block w-full bg-black">
    <div v-if="isDone" class="min-h-[60vh] flex items-center justify-center">
      <FeedDoneScreen @back="goPrev" @restart="restart" />
    </div>

    <FeedItem
      v-else-if="activeItem"
      :feed-item="activeItem"
      :is-active="true"
      :src="preload.getSrc(activeItem.mediaAssetId)"
      :src-error="preload.getError(activeItem.mediaAssetId)"
      :can-prev="nav.hasPrev.value"
      :can-next="nav.hasNext.value"
      :profile-name-by-id="props.profileNameById"
      @next="goNext"
      @prev="goPrev"
      @watchedHalf="emit('watchedHalf', { index: nav.activeIndex.value })"
      @addIdentityTag="emit('addIdentityTag', $event)"
      @removeIdentityTag="emit('removeIdentityTag', $event)"
    />
  </div>
</template>

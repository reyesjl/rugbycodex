<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { FeedItem as FeedItemType } from '@/modules/feed/types/FeedItem';
import { useFeedNavigation } from '@/modules/feed/composables/useFeedNavigation';
import { useFeedPreload } from '@/modules/feed/composables/useFeedPreload';
import FeedItem from '@/modules/feed/components/FeedItem.vue';
import FeedDoneScreen from '@/modules/feed/components/FeedDoneScreen.vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Virtual } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/swiper.css';

/**
 * Owns feed list + active index.
 *
 * Responsibilities:
 * - Active index management (next/prev/setActive)
 * - Preload adjacent clips
 * - Ensure only active FeedItem plays (by passing isActive)
 * - Uses Swiper Virtual mode to only render slides in viewport (Safari optimization)
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

const swiperInstance = ref<SwiperType | null>(null);

// Swiper modules
const swiperModules = [Virtual];

// Virtual slide configuration
// Only renders slides in viewport + buffer (saves memory on Safari)
const virtualConfig = {
  enabled: true,
  addSlidesBefore: 1,  // Render 1 slide before active
  addSlidesAfter: 1,   // Render 1 slide after active
  cache: false,        // Don't cache slides (force cleanup)
};

function onSwiper(swiper: SwiperType) {
  console.log('[FeedContainer] onSwiper called', { 
    initialIndex: initialIndex.value,
    virtualEnabled: !!(swiper as any).virtual,
    totalSlides: items.value.length
  });
  swiperInstance.value = swiper;
  // Sync swiper to initial index
  if (initialIndex.value > 0) {
    swiper.slideTo(initialIndex.value, 0);
  }
}

function onSlideChange(swiper: SwiperType) {
  const virtualData = (swiper as any).virtual;
  console.log('[FeedContainer] onSlideChange', { 
    activeIndex: swiper.activeIndex,
    previousIndex: swiper.previousIndex,
    virtualFrom: virtualData?.from,
    virtualTo: virtualData?.to,
    slidesRendered: virtualData ? virtualData.to - virtualData.from + 1 : 'N/A'
  });
  nav.setActive(swiper.activeIndex);
}

function goNext() {
  console.log('[FeedContainer] goNext called', { 
    hasSwiperInstance: !!swiperInstance.value,
    currentIndex: nav.activeIndex.value 
  });
  if (swiperInstance.value) {
    const targetIndex = Math.min(pageCount.value - 1, nav.activeIndex.value + 1);
    console.log('[FeedContainer] Calling swiper.slideTo', targetIndex);
    swiperInstance.value.slideTo(targetIndex);
  } else {
    nav.goNext();
  }
}

function goPrev() {
  console.log('[FeedContainer] goPrev called', { 
    hasSwiperInstance: !!swiperInstance.value,
    currentIndex: nav.activeIndex.value,
    swiperActiveIndex: swiperInstance.value?.activeIndex 
  });
  if (swiperInstance.value) {
    const targetIndex = Math.max(0, nav.activeIndex.value - 1);
    console.log('[FeedContainer] Calling swiper.slideTo', targetIndex);
    swiperInstance.value.slideTo(targetIndex);
  } else {
    console.log('[FeedContainer] Calling nav.goPrev()');
    nav.goPrev();
  }
}

function setActive(index: number) {
  if (swiperInstance.value) {
    swiperInstance.value.slideTo(index);
  } else {
    nav.setActive(index);
  }
}

// Watch nav changes from outside (e.g., keyboard navigation) and sync to swiper
watch(() => nav.activeIndex.value, (newIndex) => {
  if (swiperInstance.value && swiperInstance.value.activeIndex !== newIndex) {
    swiperInstance.value.slideTo(newIndex);
  }
});

function restart() {
  nav.setActive(0);
}

const isDone = computed(() => nav.activeIndex.value >= items.value.length);
const activeItem = computed(() => {
  if (isDone.value) return null;
  return items.value[nav.activeIndex.value] ?? null;
});

watch(
  () => activeItem.value,
  (next) => {
    if (!next) return;
    void preload.ensureSrcForItem(next);
  },
  { immediate: true }
);

defineExpose({
  goNext,
  goPrev,
  setActive,
  activeIndex: nav.activeIndex,
});
</script>

<template>
  <!-- Mobile: Swiper for horizontal navigation with vertical scrolling -->
  <div class="md:hidden w-full h-full bg-black">
    <Swiper
      :modules="swiperModules"
      :virtual="virtualConfig"
      :direction="'horizontal'"
      :slides-per-view="1"
      :space-between="0"
      :initial-slide="initialIndex"
      :resistance-ratio="0"
      :touch-start-prevent-default="false"
      :touch-move-stop-propagation="false"
      :nested="true"
      :loop="false"
      :allow-slide-prev="true"
      :allow-slide-next="true"
      @swiper="onSwiper"
      @slide-change="onSlideChange"
      class="h-full w-full"
    >
      <SwiperSlide
        v-for="(item, index) in items"
        :key="item.id"
        :virtual-index="index"
        class="overflow-y-auto overscroll-contain"
      >
        <div class="min-h-full">
          <FeedItem
            :feed-item="item"
            :is-active="index === nav.activeIndex.value"
            :src="preload.getSrc(item.mediaAssetId)"
            :src-error="preload.getError(item.mediaAssetId)"
            :can-prev="nav.hasPrev.value"
            :can-next="nav.hasNext.value"
            :profile-name-by-id="props.profileNameById"
            :active-index="nav.activeIndex.value"
            :total-count="items.length"
            @next="goNext"
            @prev="goPrev"
            @watchedHalf="emit('watchedHalf', { index })"
            @addIdentityTag="emit('addIdentityTag', $event)"
            @removeIdentityTag="emit('removeIdentityTag', $event)"
          />
        </div>
      </SwiperSlide>

      <!-- Final completion page -->
      <SwiperSlide class="overflow-y-auto">
        <div class="min-h-full flex items-center justify-center">
          <FeedDoneScreen @back="goPrev" @restart="restart" />
        </div>
      </SwiperSlide>
    </Swiper>
  </div>

  <!-- Desktop: normal page scroll; show only the active item -->
  <div class="hidden md:block w-full bg-black">
    <div v-if="isDone" class="min-h-[60vh] flex items-center justify-center">
      <FeedDoneScreen @back="goPrev" @restart="restart" />
    </div>

    <FeedItem
      v-else-if="activeItem"
      :key="String(activeItem.mediaAssetSegmentId || activeItem.mediaAssetId)"
      :feed-item="activeItem"
      :is-active="true"
      :src="preload.getSrc(activeItem.mediaAssetId)"
      :src-error="preload.getError(activeItem.mediaAssetId)"
      :can-prev="nav.hasPrev.value"
      :can-next="nav.hasNext.value"
      :profile-name-by-id="props.profileNameById"
      :active-index="nav.activeIndex.value"
      :total-count="items.length"
      @next="goNext"
      @prev="goPrev"
      @watchedHalf="emit('watchedHalf', { index: nav.activeIndex.value })"
      @addIdentityTag="emit('addIdentityTag', $event)"
      @removeIdentityTag="emit('removeIdentityTag', $event)"
    />
  </div>
</template>

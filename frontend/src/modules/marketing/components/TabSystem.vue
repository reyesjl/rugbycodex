<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';

interface Slide {
  title: string;
  description: string;
  mediaSrc?: string;
}

defineOptions({ name: 'TabSystem' });

const props = defineProps<{
  sectionTitle: string;
  slides: Slide[];
}>();

const activeIndex = ref(0);

watch(
  () => props.slides,
  (slides) => {
    if (!slides?.length) {
      activeIndex.value = 0;
      return;
    }

    if (activeIndex.value > slides.length - 1) {
      activeIndex.value = 0;
    }
  },
  { deep: true }
);

const counterText = computed(() => {
  const total = props.slides?.length ?? 0;
  if (!total) return '00 / 00';

  const format = (value: number) => value.toString().padStart(2, '0');
  return `${format(activeIndex.value + 1)} / ${format(total)}`;
});

const handleTabClick = (index: number) => {
  activeIndex.value = index;
};

const handleNextClick = () => {
  const total = props.slides?.length ?? 0;
  if (!total) return;
  activeIndex.value = (activeIndex.value + 1) % total;
};
</script>

<template>
  <section class="bg-black py-20">
    <div class="container-lg flex flex-col space-y-8">
      <div class="text-2xl md:text-4xl text-white">
        {{ props.sectionTitle }}
      </div>

      <div
        v-if="props.slides?.length"
        class="tabs overflow-x-scroll no-scrollbar border border-b-white text-xs md:text-base flex items-center"
      >
        <button
          v-for="(slide, index) in props.slides"
          :key="`${slide.title}-${index}`"
          type="button"
          class="tab pb-4 pr-8 border-b font-medium cursor-pointer whitespace-nowrap"
          :class="index === activeIndex
            ? 'border-white text-white'
            : 'border-transparent text-gray-500'"
          @click="handleTabClick(index)"
        >
          {{ slide.title }}
        </button>
      </div>

      <div v-if="props.slides?.length" class="relative">
        <div
          v-for="(slide, index) in props.slides"
          :key="`${slide.title}-content-${index}`"
          class="bg-white text-black py-8 transition-opacity duration-500 ease-in-out"
          :class="index === activeIndex
            ? 'opacity-100 relative pointer-events-auto'
            : 'opacity-0 absolute inset-0 pointer-events-none w-full h-full'"
        >
          <div class="grid grid-cols-1 md:grid-cols-12 grid-rows-none md:grid-rows-[auto_auto_1fr] gap-8 relative">
            <div class="order-1 md:order-0 md:col-start-1 md:col-end-2 md:row-start-1 pl-4 text-xs flex md:items-start items-center justify-between w-full">
              <span>{{ counterText }}</span>
              <button
                type="button"
                class="md:hidden inline-flex items-center justify-center p-2 mr-5 text-black bg-black/10 rounded-full"
                aria-label="Next slide"
                @click="handleNextClick"
              >
                <Icon icon="carbon:chevron-right" class="h-8 w-8" />
              </button>
            </div>

            <div class="order-2 md:order-0 md:col-start-3 md:col-end-7 md:row-start-1 space-y-4 px-4 md:px-0">
              <div class="desc-title text-xs uppercase tracking-wide">
                {{ slide.title }}
              </div>
              <p class="desc-text text-lg md:text-xl max-w-xl md:leading-loose">
                {{ slide.description }}
              </p>
            </div>

            <div class="order-3 md:order-0 md:col-start-9 md:col-end-13 md:row-start-1 md:row-end-4 md:pr-8">
              <div v-if="slide.mediaSrc" class="w-full h-full aspect-video">
                <img :src="slide.mediaSrc" class="w-full h-full object-cover md:rounded-lg" />
              </div>
              <div v-else class="w-full h-full aspect-video bg-gray-200 text-xs text-gray-500 flex justify-center items-center">
                [demo coming soon]
              </div>
            </div>

            <div class="order-4 md:order-0 md:col-start-1 md:col-end-2 md:row-start-3 flex items-end pl-4 mb-[-0.5rem]">
              <div class="text-6xl md:text-8xl leading-none">
                {{ index + 1 }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

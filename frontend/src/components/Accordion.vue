<script setup lang="ts">
import { ref, watch } from 'vue';
import { Icon } from '@iconify/vue';

interface AccordionItem {
  title: string;
  description: string;
  icon?: string;
  iconClass?: string;
}

const props = withDefaults(defineProps<{
  items: AccordionItem[];
  defaultOpen?: number;
}>(), {
  defaultOpen: 0
});

const activeIndex = ref(props.defaultOpen);

watch(() => props.defaultOpen, (next) => {
  activeIndex.value = next;
});

const toggleItem = (index: number) => {
  activeIndex.value = activeIndex.value === index ? -1 : index;
};
</script>

<template>
  <div
    class="w-full divide-y divide-neutral-700 rounded-xs border border-neutral-700 bg-neutral-950 text-neutral-100 shadow-sm"
  >
    <div v-for="(item, index) in items" :key="item.title">
      <div>
        <button
          type="button"
          :id="`accordion-trigger-${index}`"
          class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-neutral-900"
          @click="toggleItem(index)"
          :aria-expanded="activeIndex === index"
          :aria-controls="`accordion-panel-${index}`"
        >
          <span class="text-sm font-semibold md:text-base">
            {{ item.title }}
          </span>
          <Icon
            :icon="activeIndex === index ? 'carbon:subtract' : 'carbon:add'"
            class="h-5 w-5 text-neutral-400 transition-transform duration-200"
            aria-hidden="true"
          />
        </button>
        <div
          :id="`accordion-panel-${index}`"
          class="overflow-hidden transition-all duration-300 ease-in-out"
          :class="{
            'max-h-0 opacity-0': activeIndex !== index,
            'max-h-40 opacity-100': activeIndex === index
          }"
        >
          <div class="px-4 py-5 text-sm leading-relaxed text-neutral-300">
            {{ item.description }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

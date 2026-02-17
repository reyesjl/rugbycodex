<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { animateMini } from 'motion';
import type { DOMKeyframesDefinition } from 'motion';

interface Props {
  title: string;
  systemTitle: string;
  systemCode: string;
  description: string;
  icon?: string | null;
}

withDefaults(defineProps<Props>(), {
  icon: null,
});

const headline = ref<HTMLElement | null>(null);
const col1 = ref<HTMLElement | null>(null);
const col2 = ref<HTMLElement | null>(null);
const col3 = ref<HTMLElement | null>(null);

let observer: globalThis.IntersectionObserver | null = null;

onMounted(() => {
  const items = [headline.value, col1.value, col2.value, col3.value].filter(
    (el): el is HTMLElement => el !== null
  );

  const targetElement = items[0];
  if (!targetElement) return;

  const keyframes: DOMKeyframesDefinition = {
    opacity: [0, 1],
    transform: ['translateY(30px)', 'translateY(0px)'],
  };
  const animateItems = () => {
    items.forEach((el, i) => {
      const controls = animateMini(el, keyframes, { duration: 0.7, delay: i * 0.15, ease: 'easeOut' });
      controls.then(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0px)';
      });
    });
  };

  if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
    animateItems();
    return;
  }

  observer = new window.IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        animateItems();
        observer?.disconnect();
      }
    },
    { threshold: 0.1 }
  );

  observer.observe(targetElement);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<template>
  <section class="navclear bg-black text-white">
    <div class="container-lg pt-50 flex flex-col gap-8 justify-end">
      
      <!-- HEADLINE -->
      <h2 ref="headline" class="text-5xl md:text-9xl font-bold motion-item">{{ title }}</h2>

      <!-- THREE COLUMNS -->
      <div class="grid md:grid-cols-12 gap-6 text-xs mt-6 pb-8 uppercase">
        
        <!-- LEFT COLUMN -->
        <div ref="col1" class="md:col-start-1 md:col-end-3 space-y-3 motion-item">
          <p>{{ systemTitle }}</p>
          <!-- Consolas font -->
          <p class="text-sm console-font">[{{ systemCode }}]</p>
        </div>

        <!-- MIDDLE COLUMN -->
        <div ref="col2" class="md:col-start-3 md:col-end-8 motion-item">
          {{ description }}
        </div>

        <!-- RIGHT COLUMN -->
        <div ref="col3" class="md:col-start-8 md:col-end-13 flex justify-end motion-item"
             v-if="icon">
          <Icon :icon="icon" width="32" height="32" class="text-white mt-2" />
        </div>

      </div>
    </div>
  </section>
</template>

<style scoped>
.motion-item {
  opacity: 0;
  transform: translateY(30px);
}
.console-font {
  font-family: 'Consolas', monospace;
}
</style>

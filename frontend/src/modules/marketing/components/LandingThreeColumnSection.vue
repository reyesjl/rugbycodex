<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { animateMini } from 'motion';
import type { DOMKeyframesDefinition } from 'motion';
import Button from '@/components/ui/primitives/Button.vue';

interface Props {
  title?: string;
  systemTitle?: string;
  systemCode?: string;
  description?: string;
  roleLabel?: string;
  heroHeadline?: string;
  heroSubhead?: string;
  primaryCtaLabel?: string;
  primaryCtaTo?: string;
  heroBgClass?: string;
  icon?: string | null;
}

withDefaults(defineProps<Props>(), {
  title: '',
  systemTitle: '',
  systemCode: '',
  description: '',
  roleLabel: '',
  heroHeadline: '',
  heroSubhead: '',
  primaryCtaLabel: '',
  primaryCtaTo: '',
  heroBgClass: 'bg-black',
  icon: null,
});

const headline = ref<HTMLElement | null>(null);
const col1 = ref<HTMLElement | null>(null);
const col2 = ref<HTMLElement | null>(null);
const col3 = ref<HTMLElement | null>(null);
const cta = ref<HTMLElement | null>(null);

let observer: globalThis.IntersectionObserver | null = null;

onMounted(() => {
  const items = [headline.value, col1.value, col2.value, col3.value, cta.value].filter(
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
  <section class="navclear text-white" :class="heroBgClass">
    <div class="container-lg pt-16 md:pt-24 pb-14 flex flex-col gap-8 justify-end">
      
      <div ref="col1" class="motion-item">
        <p class="text-xs md:text-sm uppercase tracking-[0.2em] text-white/70">
          {{ roleLabel || systemTitle }}
        </p>
      </div>

      <h2 ref="headline" class="text-4xl md:text-7xl font-semibold max-w-5xl leading-tight">
        {{ heroHeadline || title }}
      </h2>

      <p ref="col2" class="motion-item text-lg md:text-2xl text-white/85 max-w-4xl">
        {{ heroSubhead || description }}
      </p>

      <div ref="cta" class="motion-item flex items-center gap-4">
        <Button
          v-if="primaryCtaLabel && primaryCtaTo"
          size="lg"
          variant="base"
          color="primary"
          :to="primaryCtaTo"
        >
          {{ primaryCtaLabel }}
        </Button>
      </div>

      <div class="grid md:grid-cols-12 gap-6 text-xs mt-2 uppercase">
        <div ref="col3" class="md:col-start-1 md:col-end-3 space-y-3 motion-item" v-if="systemCode">
          <p class="text-sm console-font text-white/60">[{{ systemCode }}]</p>
        </div>
        <div class="md:col-start-8 md:col-end-13 flex justify-end motion-item" v-if="icon">
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

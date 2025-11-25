<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  title: { type: String, required: true },
  systemTitle: { type: String, required: true },
  systemCode: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: null },
});

const headline = ref<HTMLElement | null>(null);
const col1 = ref<HTMLElement | null>(null);
const col2 = ref<HTMLElement | null>(null);
const col3 = ref<HTMLElement | null>(null);

let observer: IntersectionObserver | null = null;

onMounted(() => {
  const items = [headline.value, col1.value, col2.value, col3.value].filter(
    (el): el is HTMLElement => el !== null
  );

  const targetElement = items[0];
  if (!targetElement) return;

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        items.forEach((el, i) => {
          setTimeout(() => el.classList.add('visible'), i * 150);
        });
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
  <section class="navclear bg-black text-white" data-nav-theme="dark">
    <div class="container-lg pt-50 flex flex-col gap-8 justify-end">
      
      <!-- HEADLINE -->
      <h2 ref="headline" class="text-5xl md:text-9xl font-bold fade-item">{{ title }}</h2>

      <!-- THREE COLUMNS -->
      <div class="grid md:grid-cols-12 gap-6 text-xs mt-6 pb-8 uppercase">
        
        <!-- LEFT COLUMN -->
        <div ref="col1" class="md:col-start-1 md:col-end-3 space-y-3 fade-item">
          <p>{{ systemTitle }}</p>
          <p>[ {{ systemCode }} ]</p>
        </div>

        <!-- MIDDLE COLUMN -->
        <div ref="col2" class="md:col-start-3 md:col-end-8 fade-item">
          {{ description }}
        </div>

        <!-- RIGHT COLUMN -->
        <div ref="col3" class="md:col-start-8 md:col-end-13 flex justify-end fade-item"
             v-if="icon">
          <Icon :icon="icon" width="32" height="32" class="text-white mt-2" />
        </div>

      </div>
    </div>
  </section>
</template>

<style scoped>
.fade-item {
  opacity: 0;
  transform: translateY(30px);
  transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1);
}
.fade-item.visible {
  opacity: 1;
  transform: translateY(0);
}
</style>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { RouterLink } from 'vue-router';

interface Props {
  src: string;
  title: string;
  description?: string;
  to?: string;
}

const props = defineProps<Props>();
</script>

<template>
  <component
    :is="props.to ? RouterLink : 'div'"
    :to="props.to"
    class="relative aspect-square overflow-hidden group cursor-pointer"
  >
    <img :src="props.src" class="h-full w-full object-cover" />
    <div class="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
    <div class="absolute inset-0 z-20 flex flex-col justify-end px-4 py-10">
      <div class="md:w-80">
        <h3 class="text-white font-semibold text-2xl tracking-wide">{{ props.title }}</h3>
        <p v-if="props.description" class="mt-2 leading-snug text-white">
          {{ props.description }}
        </p>
      </div>
    </div>
    <div
      class="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center text-white transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 md:top-auto md:bottom-3"
    >
      <Icon icon="carbon:arrow-up-right" class="h-8 w-8" />
    </div>
  </component>
</template>

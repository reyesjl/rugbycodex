<script setup lang="ts">
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
    <div class="absolute inset-0 bg-black/40 z-10 transition-opacity duration-500 group-hover:bg-black/60 group-hover:backdrop-blur-xs"></div>
    <div class="absolute inset-0 z-20 flex flex-col justify-end p-4">
      <div class="transform translate-y-0 md:translate-y-5 md:group-hover:translate-y-0 transition-transform duration-500 ease-out md:w-80">
        <h3 class="text-white font-semibold text-xl tracking-wide translate-y-0 md:group-hover:translate-y-0 duration-500 ease-out">{{ props.title }}</h3>
        <p v-if="props.description" class="mt-2 leading-snug text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 ease-out">
          {{ props.description }}
        </p>
      </div>
    </div>
  </component>
</template>

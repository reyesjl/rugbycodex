<script setup lang="ts">
interface Props {
  imgSrc: string;
}

const props = defineProps<Props>();
</script>

<template>
  <div class="relative w-full overflow-hidden">
    <img
      :src="props.imgSrc"
      alt="Hero background"
      class="w-full h-auto md:h-screen object-cover"
      loading="lazy"
    />
    <div
      class="absolute bottom-0 left-0 right-0 h-20 md:h-40 pointer-events-none bg-gradient-to-t from-black via-black/70 to-transparent"
    ></div>
  </div>
</template>

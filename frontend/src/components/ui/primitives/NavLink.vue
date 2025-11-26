<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";

const props = defineProps<{ to: string }>();
const route = useRoute();

const isActive = computed(() => route.path.startsWith(props.to));
</script>

<template>
  <RouterLink
    :to="to"
    class="whitespace-nowrap transition-colors duration-150"
    :class="[
      isActive ? 'text-white' : 'text-neutral-400',
      'hover:text-neutral-200',
    ]"
  >
    <slot />
  </RouterLink>
</template>

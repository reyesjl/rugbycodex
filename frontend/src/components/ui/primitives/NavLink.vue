<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";

const props = defineProps<{ to: string }>();
const route = useRoute();

const isActive = computed(() => route.path === props.to);
</script>

<template>
  <RouterLink
    :to="to"
    class="whitespace-nowrap transition-colors duration-150"
    :class="[
      isActive ? 'underline underline-offset-4' : '',
      'text-white hover:text-neutral-400',
    ]"
  >
    <slot />
  </RouterLink>
</template>

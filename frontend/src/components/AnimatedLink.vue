<script setup lang="ts">

const props = defineProps<{
  to?: string;
  text?: string;
}>();

</script>

<template>
    <RouterLink
        :to="props.to ?? '/'"
        class="relative text-lg font-medium text-neutral-800 dark:text-neutral-200 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 dark:focus-visible:ring-neutral-600/60 after:absolute after:left-0 after:-bottom-0.5 after:h-0.5 after:w-full after:scale-x-0 after:origin-left after:rounded-full after:bg-current after:transition-transform after:duration-200 hover:after:scale-x-100">
        {{ props.text ?? 'Link' }}
    </RouterLink>
</template>
<!-- PrincipleCard.vue -->
<script setup lang="ts">
import { Icon } from '@iconify/vue';
defineProps<{
  number: string
  title: string
  body: string
  href: string
  linkLabel: string
  icon?: string // optional Iconify name
}>()
</script>

<template>
  <article
    class="group relative flex flex-col justify-between rounded-sm border py-10 px-5"
  >
    <header class="mb-4 flex items-center gap-3">
      <span class="text-xs font-semibold tracking-widest text-zinc-400 dark:text-black/60">
        {{ number }}
      </span>
      <h3 class="text-lg sm:text-xl font-semibold text-zinc-100 dark:text-black">{{ title }}</h3>
    </header>

    <!-- icon display area -->
    <div class="h-16 sm:h-20 grid place-items-center">
      <Icon v-if="icon" :icon="icon" class="h-15 w-15 text-white dark:text-black" aria-hidden="true" />
    </div>

    <p class="h-25 mt-6 text-left text-sm sm:text-base text-zinc-300/90 leading-relaxed dark:text-black/80">
      {{ body }}
    </p>

    <footer class="mt-6 flex justify-end">
      <a :href="href" class="inline-flex items-right md:items-left gap-2 text-sm font-medium text-white hover:underline dark:text-black">
        {{ linkLabel }}
        <Icon icon="carbon:arrow-up-right" class="h-4 w-4" />
      </a>
    </footer>

    <!-- focus ring -->
    <span class="absolute inset-0 rounded-2xl ring-0 ring-offset-0 focus-within:ring-2 ring-white/10 dark:ring-black/10">
      <span class="sr-only">{{ title }}</span>
    </span>
  </article>
</template>

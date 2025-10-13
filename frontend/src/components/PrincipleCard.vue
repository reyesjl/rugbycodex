<!-- PrincipleCard.vue -->
<script setup lang="ts">
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
    class="group relative flex flex-col justify-between rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-6 sm:p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.06)] transition-shadow dark:border-transparent dark:bg-transparent dark:shadow-none dark:hover:shadow-none"
  >
    <header class="mb-4 flex items-center gap-3">
      <span class="text-xs font-semibold tracking-widest text-zinc-400 dark:text-black/60">
        {{ number }}
      </span>
      <h3 class="text-lg sm:text-xl font-semibold text-zinc-100 dark:text-black">{{ title }}</h3>
      <iconify-icon v-if="icon" :icon="icon" class="ml-auto h-5 w-5 text-zinc-400/70 dark:text-black/60" />
    </header>

    <p class="text-left text-sm sm:text-base text-zinc-300/90 leading-relaxed dark:text-black/80">
      {{ body }}
    </p>

    <!-- tiny monochrome diagram placeholder; swap for SVGs later -->
    <div class="mt-5 h-16 sm:h-20 rounded-md border border-zinc-800/70 bg-zinc-900/40 grid place-items-center dark:border-transparent dark:bg-transparent">
      <div class="h-6 w-24 border-t border-b border-zinc-700/70 dark:border-black/10"></div>
    </div>

    <footer class="mt-6">
      <a :href="href" class="inline-flex items-left gap-2 text-sm font-medium text-zinc-100 hover:underline dark:text-black">
        {{ linkLabel }}
        <iconify-icon icon="carbon:arrow-up-right" class="h-4 w-4" />
      </a>
    </footer>

    <!-- focus ring -->
    <span class="absolute inset-0 rounded-2xl ring-0 ring-offset-0 focus-within:ring-2 ring-white/10 dark:ring-black/10">
      <span class="sr-only">{{ title }}</span>
    </span>
  </article>
</template>

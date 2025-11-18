<script setup lang="ts">
import Pill from '@/components/ui/Pill.vue';

const pillVariants = [
  { value: 'default', label: 'Default' },
  { value: 'warning', label: 'Warning' },
  { value: 'danger', label: 'Danger' },
  { value: 'success', label: 'Success' },
  { value: 'info', label: 'Info' },
] as const;
</script>

<template>
  <div class="container space-y-10 py-12">
    <header class="space-y-4">
      <p class="text-sm font-semibold uppercase tracking-widest text-emerald-500">
        CodexUI
      </p>
      <h1 class="text-3xl font-semibold text-neutral-900 dark:text-white">
        Rugbycodex Interface Components
      </h1>
      <p class="text-base text-neutral-500 dark:text-neutral-400 max-w-2xl">
        A living surface to preview UI elements exactly as they ship. This space is intentionally
        hidden from navigation—admins can visit <code>/codexui</code> whenever they need to review
        styles in isolation.
      </p>
    </header>

    <section class="space-y-6 rounded-3xl border border-neutral-200/80 dark:border-white/10 p-6">
      <div class="flex flex-col gap-2">
        <div class="text-lg font-medium text-neutral-900 dark:text-white">Pill</div>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          Status tag component showcasing its available variants.
        </p>
      </div>
      <div class="flex flex-wrap gap-4">
        <div
          v-for="pill in pillVariants"
          :key="pill.value"
          class="flex items-center gap-3 rounded-2xl bg-neutral-50/80 px-4 py-3 dark:bg-white/5"
        >
          <Pill :variant="pill.value">
            {{ pill.label }}
          </Pill>
          <span class="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400 tracking-wide">
            {{ pill.value }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

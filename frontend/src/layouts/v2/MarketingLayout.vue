<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900">
    <header class="border-b border-gray-200">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div class="text-lg font-semibold tracking-tight">RugbyCodex</div>
        <nav class="flex items-center gap-6 text-sm text-gray-700">
          <RouterLink to="/v2/marketing" class="transition hover:text-gray-900">Home</RouterLink>
          <span class="text-gray-400">Product</span>
          <span class="text-gray-400">Pricing</span>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-10">
      <RouterView />
    </main>
  </div>
</template>

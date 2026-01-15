<script setup lang="ts">
import { RouterView } from 'vue-router';
import { CDN_BASE } from '@/lib/cdn';

defineProps<{
    toggleDarkMode: () => void;
}>();

const heroGif = `${CDN_BASE}/static/assets/logos/animated/gif-logo-white.gif`;
</script>

<template>
    <main class="min-h-screen bg-black text-white">
        <div
            class="mx-auto flex min-h-screen max-w-[520px] flex-col items-center justify-start px-6 py-12"
        >
            <div class="flex w-full flex-col items-center gap-1 text-center">
                <img
                    :src="heroGif"
                    alt="Rugbycodex animated rugby ball"
                    class="w-44 max-w-full sm:w-56 md:w-64 lg:w-72"
                    loading="eager"
                    decoding="async"
                    fetchpriority="high"
                />
            </div>
            <div class="mt-10 w-full max-w-[420px] text-left">
                <RouterView />
            </div>
        </div>
    </main>
</template>

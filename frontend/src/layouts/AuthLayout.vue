<script setup lang="ts">
import { RouterView } from 'vue-router';
import { CDN_BASE } from '@/lib/cdn';

defineProps<{
    toggleDarkMode: () => void;
}>();

const heroVideo = `${CDN_BASE}/static/assets/logos/animated/webm-logo-white-full.webm`;
</script>

<template>
    <main class="min-h-screen bg-black text-white">
        <div
            class="mx-auto flex min-h-screen max-w-[520px] flex-col items-center justify-start px-6 py-12"
        >
            <div class="flex w-full flex-col items-center gap-1 text-center">
                <video
                    :src="heroVideo"
                    class="w-44 max-w-full sm:w-56 md:w-64 lg:w-72"
                    autoplay
                    muted
                    loop
                    playsinline
                    preload="auto"
                    aria-label="Rugbycodex animated rugby ball"
                ></video>
            </div>
            <div class="mt-10 w-full max-w-[420px] text-left">
                <RouterView />
            </div>
        </div>
    </main>
</template>

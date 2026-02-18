<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { animateMini } from 'motion';
import { CDN_BASE } from '@/lib/cdn';

defineProps<{
    toggleDarkMode: () => void;
}>();

const heroVideo = `${CDN_BASE}/static/assets/logos/animated/mp4-logo-white-1280.mp4`;
const route = useRoute();
const heroLogoRef = ref<HTMLElement | null>(null);
const authContentRef = ref<HTMLElement | null>(null);

watch(
    () => route.fullPath,
    async () => {
        await nextTick();
        if (heroLogoRef.value) {
            animateMini(
                heroLogoRef.value,
                { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0px)'] },
                { duration: 0.6, ease: 'easeOut' },
            );
        }
        if (!authContentRef.value) return;
        animateMini(
            authContentRef.value,
            { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0px)'] },
            { duration: 0.6, delay: 0.08, ease: 'easeOut' },
        );
    },
    { immediate: true },
);
</script>

<template>
    <main class="min-h-screen bg-black text-white">
        <div
            class="mx-auto flex min-h-screen max-w-[520px] flex-col items-center justify-start px-6 py-12"
        >
            <div ref="heroLogoRef" class="flex w-full flex-col items-center gap-1 text-center">
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
            <div ref="authContentRef" class="mt-10 w-full max-w-[420px] text-left">
                <RouterView />
            </div>
        </div>
    </main>
</template>

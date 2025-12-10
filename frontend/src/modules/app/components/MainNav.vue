<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useAuthStore } from '@/auth/stores/useAuthStore';

const authStore = useAuthStore();
const navRef = ref<HTMLElement | null>(null);
    let resizeObserver: globalThis.ResizeObserver | null = null;

const emit = defineEmits<{
    (e: 'toggle-sidebar'): void;
}>();

const handleSidebarToggle = () => {
    emit('toggle-sidebar');
};

const setNavHeightVar = () => {
    if (navRef.value) {
        document.documentElement.style.setProperty(
            '--main-nav-height',
            `${navRef.value.offsetHeight}px`
        );
        console.log('Main nav height set to', `${navRef.value.offsetHeight}px`);
    }
};

const initNavResizeObserver = () => {
    if (typeof window === 'undefined') {
        setNavHeightVar();
        return;
    }
    if (!navRef.value) {
        setNavHeightVar();
        return;
    }

    const hasResizeObserver = 'ResizeObserver' in window && typeof window.ResizeObserver === 'function';
    if (!hasResizeObserver) {
        setNavHeightVar();
        return;
    }

    resizeObserver = new window.ResizeObserver(() => {
        setNavHeightVar();
    });
    resizeObserver.observe(navRef.value);
};

onMounted(() => {
    setNavHeightVar();
    initNavResizeObserver();
});

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (typeof window !== 'undefined') {
        document.documentElement.style.removeProperty('--main-nav-height');
    }
});
</script>

<template>
    <nav ref="navRef" class="fixed top-0 left-0 w-full backdrop-blur text-white z-50">
        <div class="container-lg py-5 flex items-center justify-between">
            <!-- Left -->
            <div class="flex items-center">
                <div class="flex">
                    <Icon @click="handleSidebarToggle" icon="carbon:menu" width="25" height="25" class="mr-5 w-full cursor-pointer"/>
                </div>
                <div class="text-xl select-none">RUGBY<span class="font-semibold">CODEX</span></div>
            </div>

            <!-- Right -->
            <div class="justify-end">
                <div class="flex flex-row items-center text-white">
                    <div>
                        <Icon icon="carbon:search"  width="25" height="25" class="h-full w-full p-2 hover:bg-white/10 rounded-full cursor-pointer" />    
                    </div>
                    <div>
                        <Icon icon="carbon:notification"  width="25" height="25" class="h-full w-full p-2 hover:bg-white/10 rounded-full cursor-pointer" />    
                    </div>
                    <RouterLink v-if="authStore.isAuthenticated" :to="`/v2/dashboard`">
                        <Icon icon="carbon:user-avatar"  width="25" height="25" class="h-full w-full p-2 hover:bg-white/10 rounded-full cursor-pointer" />    
                    </RouterLink>
                </div>
            </div>
        </div>
    </nav>
</template>

<style scoped>

</style>

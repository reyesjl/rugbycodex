<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

const NAV_VISIBLE_TOP = '0px';
const NAV_HIDDEN_TOP = '-120px';
const MIN_SCROLL_DELTA = 6;
const SCROLL_HIDE_OFFSET = 64;

const isMenuOpen = ref(false);
const isNavHidden = ref(false);
const isAtTop = ref(true);
const lastScrollY = ref(0);
const navRef = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

const navPositionStyle = computed(() => ({
    top: isNavHidden.value ? NAV_HIDDEN_TOP : NAV_VISIBLE_TOP,
}));

const toggleMenu = () => {
    isMenuOpen.value = !isMenuOpen.value;
};

const closeMenu = () => {
    isMenuOpen.value = false;
};

const updateNavVisibility = () => {
    if (typeof window === 'undefined') {
        return;
    }

    const currentScrollY = window.scrollY || 0;
    const delta = currentScrollY - lastScrollY.value;
    isAtTop.value = currentScrollY <= 0;

    if (Math.abs(delta) < MIN_SCROLL_DELTA) {
        return;
    }

    if (currentScrollY <= SCROLL_HIDE_OFFSET || delta < 0) {
        isNavHidden.value = false;
    } else if (delta > 0 && currentScrollY > SCROLL_HIDE_OFFSET) {
        isNavHidden.value = false;
    }

    lastScrollY.value = currentScrollY;
};

const setNavHeightVar = () => {
    if (typeof window === 'undefined' || !navRef.value) {
        return;
    }

    const height = navRef.value.offsetHeight;
    document.documentElement.style.setProperty('--marketing-nav-height', `${height}px`);
};

const initNavResizeObserver = () => {
    if (typeof window === 'undefined' || !navRef.value || typeof ResizeObserver === 'undefined') {
        setNavHeightVar();
        return;
    }

    resizeObserver = new ResizeObserver(() => {
        setNavHeightVar();
    });
    resizeObserver.observe(navRef.value);
};

onMounted(() => {
    if (typeof window === 'undefined') {
        return;
    }

    lastScrollY.value = window.scrollY || 0;
    isAtTop.value = lastScrollY.value <= 0;
    window.addEventListener('scroll', updateNavVisibility, { passive: true });
    setNavHeightVar();
    initNavResizeObserver();
});

onBeforeUnmount(() => {
    if (typeof window === 'undefined') {
        return;
    }

    window.removeEventListener('scroll', updateNavVisibility);
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (typeof window !== 'undefined') {
        document.documentElement.style.removeProperty('--marketing-nav-height');
    }
});

watch(isMenuOpen, (isOpen) => {
    if (isOpen) {
        isNavHidden.value = false;
    }
});
</script>

<template>
    <nav
        class="marketing-nav fixed inset-x-0 top-0 z-20 w-full"
        :class="{ 'backdrop-blur bg-black/30': !isAtTop }"
        :style="navPositionStyle"
        ref="navRef"
    >
        <div class="container-lg grid grid-cols-[auto_1fr_auto] items-center py-5">
            <RouterLink class="brand-name text-xl text-white hover:text-neutral-400" to="/v2/marketing">
                rugby<span class="font-semibold">codex</span>
            </RouterLink>

            <div class="hidden justify-center md:flex md:gap-8 sm:text-sm">
                <RouterLink class="text-white hover:text-neutral-400 whitespace-nowrap" to="/v2/marketing/for-coaches">
                    For Coaches
                </RouterLink>
                <RouterLink class="text-white hover:text-neutral-400 whitespace-nowrap" to="/v2/marketing/for-players">
                    For Players
                </RouterLink>
                <RouterLink class="text-white hover:text-neutral-400 whitespace-nowrap" to="/v2/marketing">
                    Inside the Codex
                </RouterLink>
            </div>

            <div class="hidden justify-end space-x-4 md:flex items-center sm:text-sm">
                <RouterLink class="text-white hover:text-neutral-400 whitespace-nowrap" to="/v2/marketing">
                    Login
                </RouterLink>
                <RouterLink class="text-white px-2 py-1 border-1 border-neutral-400 hover:bg-neutral-100 hover:text-black whitespace-nowrap transition" to="/v2/marketing">
                    Get Started
                </RouterLink>
            </div>

            <button
                class="justify-self-end text-sm text-white font-semibold lowercase transition md:hidden"
                type="button"
                aria-label="Open menu"
                :aria-expanded="isMenuOpen"
                @click="toggleMenu"
            >
                <Icon icon="carbon:menu" width="24" height="24" />
            </button>
        </div>
    </nav>

    <transition name="marketing-nav-fade">
        <div
            v-if="isMenuOpen"
            class="fixed inset-0 z-50 grid grid-rows-[auto_1fr] text-white bg-black/50 backdrop-blur-xs md:hidden"
            @click.self="closeMenu"
        >
            <div class="container-lg grid grid-cols-[auto_1fr_auto] items-center w-full py-5">
                <RouterLink class="brand-name text-xl dark:text-white" to="/v2/marketing">
                    rugby<span class="font-semibold">codex</span>
                </RouterLink>

                <div></div>

                <button
                    class="justify-self-end text-sm font-semibold lowercase text-white transition"
                    type="button"
                    aria-label="Close menu"
                    @click="closeMenu"
                >
                    <Icon icon="carbon:close" width="28" height="28" />
                </button>
            </div>

            <div class="flex flex-col items-end mt-10 space-y-6 px-6 text-3xl font-semibold lowercase">
                <RouterLink
                    class="text-right hover:text-neutral-500 text-white w-full"
                    to="/v2/marketing/for-coaches"
                    @click="closeMenu"
                >
                    for coaches
                </RouterLink>
                <RouterLink
                    class="text-right hover:text-neutral-500 text-white w-full"
                    to="/v2/marketing/for-players"
                    @click="closeMenu"
                >
                    for players
                </RouterLink>
                <RouterLink
                    class="text-right hover:text-neutral-500 text-white w-full"
                    to="/v2/marketing"
                    @click="closeMenu"
                >
                    inside the codex
                </RouterLink>
                <RouterLink
                    class="text-right hover:text-neutral-500 text-white w-full"
                    to="/v2/marketing"
                    @click="closeMenu"
                >
                    login
                </RouterLink>
                <RouterLink
                    class="text-right hover:text-neutral-500 text-white w-full"
                    to="/v2/marketing"
                    @click="closeMenu"
                >
                    get started
                </RouterLink>
            </div>
        </div>
    </transition>
</template>

<style scoped>
.marketing-nav-fade-enter-active,
.marketing-nav-fade-leave-active {
    transition: opacity 0.25s ease;
}

.marketing-nav-fade-enter-from,
.marketing-nav-fade-leave-to {
    opacity: 0;
}

.marketing-nav {
    transition: top 0.35s ease-in-out;
    will-change: top;
}
</style>

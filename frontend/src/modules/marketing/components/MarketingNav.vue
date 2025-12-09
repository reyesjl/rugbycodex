<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import Button from '@/components/ui/primitives/Button.vue';
import NavLink from '@/components/ui/primitives/NavLink.vue';
import { useAuthStore } from '@/auth/stores/useAuthStore';

const authStore = useAuthStore();

const NAV_VISIBLE_TOP = '0px';
const NAV_HIDDEN_TOP = '-120px';
const MIN_SCROLL_DELTA = 6;
const SCROLL_HIDE_OFFSET = 64;

const isMenuOpen = ref(false);
const isNavHidden = ref(false);
const isAtTop = ref(true);
const lastScrollY = ref(0);
const navRef = ref<HTMLElement | null>(null);
let resizeObserver: globalThis.ResizeObserver | null = null;

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
        lastScrollY.value = currentScrollY;
        return;
    }

    if (currentScrollY <= SCROLL_HIDE_OFFSET) {
        // near the top: always show
        isNavHidden.value = false;
    } else if (delta > 0) {
        // scrolling down: hide nav
        isNavHidden.value = true;
    } else {
        // scrolling up: show nav
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
    if (typeof window === 'undefined' || !navRef.value) {
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
                RUGBY<span class="font-semibold">CODEX</span>
            </RouterLink>

            <div class="hidden justify-center md:flex md:gap-8 sm:text-sm">
                <NavLink to="/v2/marketing">
                    Home
                </NavLink>
                <NavLink to="/v2/marketing/coaches">
                    Coaches
                </NavLink>
                <NavLink to="/v2/marketing/players">
                    Players
                </NavLink>
                <NavLink to="/v2/marketing/unions">
                    Unions
                </NavLink>
                <!-- <NavLink to="/v2/marketing/inside">
                    Inside the Codex
                </NavLink> -->
                <NavLink to="/v2/marketing/mission">
                    Mission
                </NavLink>
            </div>

            <!-- Display profile button if user is logged in -->
            <!-- authStore.isAuthenticated -->
            <RouterLink v-if="authStore.isAuthenticated" class="hidden justify-end md:flex items-center space-x-2 sm:text-sm" :to="`/v2/dashboard`">
                <Icon icon="carbon:user-avatar"  width="25" height="25" class="h-full w-full p-2 text-white rounded-full cursor-pointer" />    
            </RouterLink> 
            <div v-else class="hidden justify-end space-x-4 md:flex items-center sm:text-sm">
                <RouterLink class="text-white hover:text-neutral-400 whitespace-nowrap" to="/v2/auth/login">
                    Login
                </RouterLink>
                <Button variant="base" color="primary" to="/v2/auth/signup">Get Started</Button>
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
            class="fixed inset-0 z-50 grid grid-rows-[auto_1fr] text-white bg-black/50 backdrop-blur md:hidden"
            @click.self="closeMenu"
        >
            <div class="container-lg grid grid-cols-[auto_1fr_auto] items-center w-full py-5">
                <RouterLink class="brand-name text-xl dark:text-white" to="/v2/marketing">
                    RUGBY<span class="font-semibold">CODEX</span>
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

            <div class="flex flex-col pt-10 space-y-6 px-5 text-2xl capitalize">
                <RouterLink
                    class="hover:text-neutral-500 text-white w-fit"
                    to="/v2/marketing"
                    @click="closeMenu"
                >
                    Home
                </RouterLink>
                <RouterLink
                    class="hover:text-neutral-500 text-white w-fit"
                    to="/v2/marketing/coaches"
                    @click="closeMenu"
                >
                    Coaches
                </RouterLink>
                <RouterLink
                    class="hover:text-neutral-500 text-white w-fit"
                    to="/v2/marketing/players"
                    @click="closeMenu"
                >
                    Players
                </RouterLink>
                <RouterLink
                    class="hover:text-neutral-500 text-white w-fit"
                    to="/v2/marketing/unions"
                    @click="closeMenu"
                >
                    Unions
                </RouterLink>
                <!-- <RouterLink
                    class="hover:text-neutral-500 text-white w-fit"
                    to="/v2/marketing"
                    @click="closeMenu"
                >
                    inside the codex
                </RouterLink> -->
                <RouterLink
                    class="hover:text-neutral-500 text-white w-fit"
                    to="/v2/marketing/mission"
                    @click="closeMenu"
                >mission</RouterLink>

                <!-- Show profile if user logged in -->
                <!-- authStore.isAuthenticated -->
                <div v-if="authStore.isAuthenticated">
                    <RouterLink
                        class="hover:text-neutral-500 text-white w-fit"
                        :to="`/v2/dashboard`"
                        @click="closeMenu"
                    >
                        profile
                    </RouterLink>
                </div>
                <div v-else class="flex flex-col space-y-6">
                    <RouterLink
                        class="hover:text-neutral-500 text-white w-fit"
                        to="/v2/auth/login"
                        @click="closeMenu"
                    >
                        login
                    </RouterLink>
                    <RouterLink
                        class="hover:text-neutral-500 text-white w-fit"
                        to="/v2/auth/signup"
                        @click="closeMenu"
                    >
                        get started
                    </RouterLink>
                </div>
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

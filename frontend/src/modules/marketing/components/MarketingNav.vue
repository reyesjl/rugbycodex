<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { animateMini } from 'motion';
import type { DOMKeyframesDefinition } from 'motion';
import { RouterLink } from 'vue-router';
import Button from '@/components/ui/primitives/Button.vue';
import NavLink from '@/components/ui/primitives/NavLink.vue';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useUserContextStore } from '@/modules/user/stores/useUserContextStore';

const authStore = useAuthStore();
const userContextStore = useUserContextStore();

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

const displayUsername = computed(() => {
    const profileUsername = userContextStore.profileReadonly?.username?.trim();
    if (profileUsername) return profileUsername;

    const metadataUsername = authStore.userReadonly?.user_metadata?.username;
    if (typeof metadataUsername === 'string' && metadataUsername.trim()) {
        return metadataUsername.trim();
    }

    const email = authStore.userReadonly?.email;
    if (email) return email.split('@')[0] ?? 'My Rugby';

    return 'My Rugby';
});

const ensureUserContextLoaded = () => {
    if (!authStore.isAuthenticated) return;
    if (userContextStore.isReady || userContextStore.isLoading) return;
    void userContextStore.load();
};

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

const runNavEntranceAnimation = () => {
    if (!navRef.value) return;

    const keyframes: DOMKeyframesDefinition = {
        opacity: [0, 1],
        transform: ['translateY(-16px)', 'translateY(0px)'],
    };

    animateMini(navRef.value, keyframes, { duration: 0.45, ease: 'easeOut' });
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
    runNavEntranceAnimation();
    ensureUserContextLoaded();
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

watch(
    () => authStore.isAuthenticated,
    (isAuthenticated) => {
        if (isAuthenticated) {
            ensureUserContextLoaded();
        }
    },
    { immediate: true },
);
</script>

<template>
    <nav
        class="marketing-nav fixed inset-x-0 top-0 z-20 w-full"
        :class="{ 'backdrop-blur bg-black/30': !isAtTop }"
        :style="navPositionStyle"
        ref="navRef"
    >
        <div class="container-lg grid grid-cols-[auto_1fr_auto] items-center py-5">
            <RouterLink class="brand-name text-xl text-white hover:text-neutral-400" to="/">
                RUGBY<span class="font-semibold">CODEX</span>
            </RouterLink>

            <div class="hidden justify-center md:flex md:gap-8 sm:text-sm">
                <NavLink to="/" class="inline-flex items-center">
                    <Icon icon="fluent-mdl2:rugby" width="18" height="18" />
                </NavLink>
                <NavLink to="/features">
                    Features
                </NavLink>
                <NavLink to="/roles">
                    Roles
                </NavLink>
                <span class="text-white/50 cursor-not-allowed select-none">
                    Pricing
                </span>
                <span class="text-white/50 cursor-not-allowed select-none">
                    Customers
                </span>
                <NavLink to="/mission">
                    About
                </NavLink>
            </div>

            <!-- Display profile button if user is logged in -->
            <!-- authStore.isAuthenticated -->
            <RouterLink v-if="authStore.isAuthenticated" class="hidden justify-end md:flex items-center space-x-2 sm:text-sm" :to="`/my-rugby`">
                <span class="nav-cta-shell shadow-[0_0_40px_rgba(59,130,246,0.35)]">
                    <span class="inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-black transition-colors hover:bg-black hover:text-white">
                        {{ displayUsername }}
                    </span>
                </span>
            </RouterLink>
            <div v-else class="hidden justify-end space-x-4 md:flex items-center sm:text-sm">
                <RouterLink class="text-white hover:text-neutral-400 whitespace-nowrap" to="/auth/login">
                    Login
                </RouterLink>
                <span class="nav-cta-shell shadow-[0_0_40px_rgba(59,130,246,0.35)]">
                    <Button variant="base" color="primary" to="/auth/waitlist" class="font-semibold !bg-white !text-black hover:!bg-black hover:!text-white">Join Waitlist</Button>
                </span>
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
                <RouterLink class="brand-name text-xl dark:text-white" to="/">
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
                    class="hover:text-neutral-500 text-white w-fit inline-flex items-center"
                    to="/"
                    @click="closeMenu"
                >
                    <Icon icon="fluent-mdl2:rugby" width="24" height="24" />
                </RouterLink>
                <RouterLink
                    class="hover:text-neutral-500 text-white w-fit"
                    to="/features"
                    @click="closeMenu"
                >
                    Features
                </RouterLink>
                <RouterLink
                    class="hover:text-neutral-500 text-white w-fit"
                    to="/roles"
                    @click="closeMenu"
                >
                    Roles
                </RouterLink>
                <span class="text-white/50 cursor-not-allowed w-fit">
                    Pricing
                </span>
                <span class="text-white/50 cursor-not-allowed w-fit">
                    Customers
                </span>
                <RouterLink
                    class="hover:text-neutral-500 text-white w-fit"
                    to="/mission"
                    @click="closeMenu"
                >About</RouterLink>

                <!-- Show profile if user logged in -->
                <!-- authStore.isAuthenticated -->
                <div v-if="authStore.isAuthenticated">
                    <RouterLink
                        class="hover:text-neutral-500 text-white w-fit"
                        :to="`/my-rugby`"
                        @click="closeMenu"
                    >
                        my rugby
                    </RouterLink>
                </div>
                <div v-else class="flex flex-col space-y-6">
                    <RouterLink
                        class="hover:text-neutral-500 text-white w-fit"
                        to="/auth/login"
                        @click="closeMenu"
                    >
                        login
                    </RouterLink>
                    <RouterLink
                        class="hover:text-neutral-500 text-white w-fit"
                        to="/auth/waitlist"
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

.nav-cta-shell {
    position: relative;
    display: inline-flex;
    padding: 2px;
    border-radius: 9999px;
    overflow: hidden;
    background: linear-gradient(120deg, rgba(30, 64, 175, 0.95), rgba(96, 165, 250, 0.9), rgba(30, 64, 175, 0.95));
}

.nav-cta-shell::before {
    content: '';
    position: absolute;
    inset: -40%;
    background: linear-gradient(115deg, transparent 42%, rgba(255, 255, 255, 0.9) 50%, transparent 58%);
    transform: translateX(-120%) rotate(10deg);
    animation: nav-cta-shine-sweep 2.4s linear infinite;
}

.nav-cta-shell :deep(a),
.nav-cta-shell :deep(button),
.nav-cta-shell > span {
    position: relative;
    z-index: 1;
    border-radius: 9999px;
}

@keyframes nav-cta-shine-sweep {
    to {
        transform: translateX(120%) rotate(10deg);
    }
}
</style>

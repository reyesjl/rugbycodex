<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { ref } from 'vue';
import { RouterLink } from 'vue-router';

const isMenuOpen = ref(false);

const middleLinks = [
    { to: '/v2/marketing', label: '[ For Teams ]' },
    { to: '/v2/marketing', label: '[ For Players ]' },
    { to: '/v2/marketing', label: '[ Inside the Codex ]' },
];

const actionLinks = [
    { to: '/v2/marketing', label: '[ Login ]' },
    { to: '/v2/marketing', label: '[ Get Started ]' },
];

const toggleMenu = () => {
    isMenuOpen.value = !isMenuOpen.value;
};

const closeMenu = () => {
    isMenuOpen.value = false;
};
</script>

<template>
    <nav class="container-lg grid grid-cols-[auto_1fr_auto] items-center py-4">
        <RouterLink class="brand-name text-xl dark:text-white" to="/v2/marketing">
            rugby<span class="font-semibold">codex</span>
        </RouterLink>

        <div class="hidden justify-center space-x-4 text-sm font-semibold lowercase md:flex">
            <RouterLink
                v-for="link in middleLinks"
                :key="link.label"
                class="text-neutral-500 hover:text-black dark:hover:text-white whitespace-nowrap"
                :to="link.to"
            >
                {{ link.label }}
            </RouterLink>
        </div>

        <div class="hidden justify-end space-x-4 text-sm font-semibold lowercase md:flex">
            <RouterLink
                v-for="link in actionLinks"
                :key="link.label"
                class="text-neutral-500 hover:text-black dark:hover:text-white whitespace-nowrap"
                :to="link.to"
            >
                {{ link.label }}
            </RouterLink>
        </div>

        <button
            class="justify-self-end text-sm dark:text-white font-semibold lowercase transition md:hidden"
            type="button"
            aria-label="Open menu"
            :aria-expanded="isMenuOpen"
            @click="toggleMenu"
        >
            <Icon icon="carbon:menu" width="24" height="24" />
        </button>
    </nav>

    <transition name="marketing-nav-fade">
        <div
            v-if="isMenuOpen"
            class="fixed inset-0 z-50 grid grid-rows-[auto_1fr] bg-white/80 text-neutral-700 backdrop-blur-xs dark:bg-neutral-900/80 dark:text-neutral-100 md:hidden"
            @click.self="closeMenu"
        >
            <div class="container-lg grid grid-cols-[auto_1fr_auto] items-center w-full py-4">
                <RouterLink class="brand-name text-xl dark:text-white" to="/v2/marketing">
                    rugby<span class="font-semibold">codex</span>
                </RouterLink>

                <div></div>

                <button
                    class="justify-self-end text-sm font-semibold lowercase text-black transition dark:text-white"
                    type="button"
                    aria-label="Close menu"
                    @click="closeMenu"
                >
                    <Icon icon="carbon:close" width="28" height="28" />
                </button>
            </div>

            <div class="flex flex-col items-end mt-10 space-y-6 px-6 text-3xl font-semibold lowercase">
                <RouterLink
                    v-for="link in [...middleLinks, ...actionLinks]"
                    :key="`mobile-${link.label}`"
                    class="text-right text-black hover:text-neutral-500 dark:text-white dark:hover:text-neutral-500 w-full"
                    :to="link.to"
                    @click="closeMenu"
                >
                    {{ link.label }}
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
</style>

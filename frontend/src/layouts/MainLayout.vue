<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { RouterLink, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
  toggleDarkMode: () => void;
}>();

const authStore = useAuthStore();

const navLinks = computed(() => [
  { to: '/inside', label: 'Inside the Codex' },
  { to: '/', label: 'Overview' },
  { to: '/narrations', label: 'Narrations' },
  { to: '/vaults', label: 'Vaults' },
  // { to: '/releases', label: 'Releases' },
  // { to: '/about', label: 'About' },
  authStore.isAuthenticated
    ? { to: '/dashboard', label: 'Dashboard' }
    : { to: '/login', label: 'Account' },
]);

const isSidebarOpen = ref(false);
const route = useRoute();
const headerRef = ref<HTMLElement | null>(null);
const headerHeight = ref(0);
const lastScrollY = ref(0);
const footerExpansion = ref(1); // 1 = fully expanded, 0 = fully collapsed
const footerTarget = ref(1);
const scrollAccumulator = ref(0);
const isMobile = ref(false);

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const closeSidebar = () => {
  isSidebarOpen.value = false;
};

const sidebarToggleIcon = computed(() =>
  isSidebarOpen.value ? 'carbon:side-panel-close-filled' : 'carbon:side-panel-open-filled'
);

const userDisplayName = computed(() => {
  const metadataName = (authStore.user?.user_metadata?.name as string | undefined)?.trim();
  const fallback = authStore.user?.email ?? 'Member';
  const base = metadataName?.length ? metadataName : fallback;
  if (base.length > 24) {
    return `${base.slice(0, 21).trimEnd()}…`;
  }
  return base;
});

const updateHeaderHeight = () => {
  headerHeight.value = headerRef.value?.offsetHeight ?? 0;
};

const updateIsMobile = () => {
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  if (mobile && !isMobile.value) {
    footerExpansion.value = 1;
    footerTarget.value = 1;
  }
  if (!mobile) {
    footerExpansion.value = 0;
    footerTarget.value = 0;
  }
  isMobile.value = mobile;
};

const updateScrollPosition = () => {
  const currentY = window.scrollY || 0;
  const delta = currentY - lastScrollY.value;
  lastScrollY.value = currentY;

  if (!isMobile.value) {
    return;
  }

  const threshold = Math.min(window.innerHeight * 0.25, 140);

  if (delta > 0) {
    if (scrollAccumulator.value < 0) {
      scrollAccumulator.value = 0;
    }
    scrollAccumulator.value += delta;
    if (scrollAccumulator.value >= threshold && footerTarget.value !== 0) {
      footerTarget.value = 0;
      footerExpansion.value = 0;
      scrollAccumulator.value = 0;
    }
  } else if (delta < 0) {
    if (scrollAccumulator.value > 0) {
      scrollAccumulator.value = 0;
    }
    scrollAccumulator.value += delta;
    if (scrollAccumulator.value <= -threshold && footerTarget.value !== 1) {
      footerTarget.value = 1;
      footerExpansion.value = 1;
      scrollAccumulator.value = 0;
    }
  }
};

const handleResize = () => {
  updateHeaderHeight();
  updateIsMobile();
};

onMounted(() => {
  nextTick(() => {
    updateHeaderHeight();
    updateIsMobile();
    updateScrollPosition();
  });
  window.addEventListener('resize', handleResize);
  window.addEventListener('scroll', updateScrollPosition, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('scroll', updateScrollPosition);
});

watch(isSidebarOpen, (open) => {
  if (open) {
    nextTick(updateHeaderHeight);
  }
});

const sidebarStyles = computed(() => ({
  top: `${headerHeight.value}px`,
  height: `calc(100vh - ${headerHeight.value}px)`,
}));

const sidebarFooterPadding = computed(() => {
  const minOffset = 24;
  const maxOffset = 120;
  if (!isMobile.value) {
    return `calc(env(safe-area-inset-bottom, 0px) + ${minOffset}px)`;
  }
  const offset = minOffset + footerExpansion.value * (maxOffset - minOffset);
  return `calc(env(safe-area-inset-bottom, 0px) + ${offset}px)`;
});

watch(
  () => route.path,
  () => {
    closeSidebar();
  }
);
</script>

<template>
  <div>
    <header
      ref="headerRef"
      class="fixed top-0 z-50 w-full bg-transparent backdrop-blur transition-colors dark:bg-neutral-950/70"
    >
      <div
        class="container flex items-center justify-between gap-6 px-6 py-5 md:px-8"
      >
        <div class="flex items-center gap-3 md:gap-4">
          <RouterLink
            to="/"
            class="text-xl tracking-medium text-neutral-900 transition-colors hover:text-black dark:text-neutral-100 dark:hover:text-white md:text-xl"
          >
            Rugby<span class="font-semibold">codex</span>
          </RouterLink>

          <button
            type="button"
            class="hidden p-2 text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white md:inline-flex"
            aria-label="Toggle navigation"
            @click="toggleSidebar"
          >
            <Icon :icon="sidebarToggleIcon" class="h-5 w-5" />
          </button>
        </div>

        <div class="flex items-center gap-3 md:gap-4">
          <button
            type="button"
            class="rounded-full bg-transparent p-2 text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            aria-label="Search"
          >
            <Icon icon="carbon:search" class="h-4 w-4" />
          </button>

          <button
            type="button"
            class="flex p-2 text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white md:hidden"
            aria-label="Toggle navigation"
            @click="toggleSidebar"
          >
            <Icon :icon="sidebarToggleIcon" class="h-5 w-5" />
          </button>

          <RouterLink
            v-if="!authStore.isAuthenticated"
            to="/login"
            class="hidden rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-800 dark:hover:bg-neutral-800 md:inline-flex md:items-center"
          >
            Log in
          </RouterLink>
          <RouterLink
            v-else
            to="/dashboard"
            class="hidden max-w-[14rem] truncate rounded-full bg-neutral-900/80 px-4 py-2 text-sm font-medium text-neutral-100 backdrop-blur transition hover:bg-neutral-900 md:inline-flex"
            :title="authStore.user?.user_metadata?.name ?? authStore.user?.email ?? undefined"
          >
            {{ userDisplayName }}
          </RouterLink>
        </div>
      </div>
    </header>

    <transition name="sidebar">
      <aside
        v-if="isSidebarOpen"
        class="fixed left-0 right-auto z-40 flex w-72 max-w-full flex-col bg-transparent text-neutral-900 shadow-2xl backdrop-blur dark:bg-neutral-950/70 dark:text-white md:w-80 md:rounded-none"
        :style="sidebarStyles"
      >
        <nav class="flex-1 space-y-1 px-4 pt-6">
          <RouterLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            custom
            v-slot="{ href, navigate, isExactActive }"
          >
            <a
              :href="href"
              @click="navigate"
              class="block rounded-2xl px-4 py-3 text-sm transition"
              :class="[
                isExactActive
                  ? 'bg-neutral-900/10 text-neutral-900 ring-1 ring-neutral-900/10 dark:bg-neutral-800 dark:text-white dark:ring-neutral-700/60'
                  : 'text-neutral-700 hover:bg-neutral-900/5 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900/60 dark:hover:text-white'
              ]"
            >
              {{ link.label }}
            </a>
          </RouterLink>
        </nav>

        <div
          class="flex items-end justify-between px-6 pt-4 transition-all duration-300 ease-out"
          :style="{ paddingBottom: sidebarFooterPadding }"
        >
          <button
            type="button"
            class="rounded-full border border-neutral-300 bg-neutral-200/70 p-2 text-sm text-neutral-600 transition hover:bg-neutral-200 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400 dark:hover:bg-neutral-800"
            aria-label="Toggle dark mode"
            @click="props.toggleDarkMode"
          >
            <Icon icon="carbon:brightness-contrast" class="h-4 w-4" />
          </button>

          <RouterLink
            v-if="!authStore.isAuthenticated"
            to="/login"
            class="rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-white/90 md:hidden"
            @click="closeSidebar"
          >
            Log in
          </RouterLink>
          <RouterLink
            v-else
            to="/dashboard"
            class="max-w-[14rem] truncate rounded-full bg-neutral-100/80 px-4 py-2 text-sm font-semibold text-neutral-900 transition hover:bg-white/90 md:hidden"
            :title="authStore.user?.user_metadata?.name ?? authStore.user?.email ?? undefined"
            @click="closeSidebar"
          >
            {{ userDisplayName }}
          </RouterLink>
        </div>
      </aside>
    </transition>

    <main>
      <slot />
    </main>

    <footer class="mt-24 bg-neutral-700 pt-16 pb-60 text-xs text-neutral-200 dark:bg-neutral-800">
      <div class="container mx-auto grid items-start gap-12 md:grid-cols-6">
        <div class="space-y-4">
          <h2 class="tracking-wide text-neutral-100">Explore</h2>
          <nav class="flex flex-col gap-2 text-neutral-300">
            <RouterLink class="transition-colors hover:text-white" to="/inside">Inside the Codex</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/">Overview</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/narrations">Narrations</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/vaults">Vaults</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/releases">Releases</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/about">About</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/login">Account</RouterLink>
          </nav>
        </div>

        <div class="space-y-4 text-neutral-300 md:col-span-3">
          <h2 class="tracking-wide text-neutral-100">About</h2>
          <p class="leading-relaxed">
            Rugbycodex imagines a shared language for the sport; where video, narration, and context meet.
            We’re building a platform that lets clubs and coaches preserve ideas, experiment with tactics,
            and keep institutional knowledge alive for the next season and beyond. Questions? Reach us at
            <a class="underline transition-colors hover:text-white" href="mailto:contact@biasware.com">contact@biasware.com</a>
          </p>
        </div>

        <div class="space-y-4 md:col-span-2">
          <h2 class="tracking-wide text-neautral-100">Credits</h2>
          <p class="leading-relaxed">
            Development <br />
            Jose Reyes <a class="text-neutral-400" href="https://www.youtube.com/watch?v=mbOP11df6QY">@reyesjl</a>
          </p>
          <p class="leading-relaxed">
            Built by<br />
            Biasware <a class="text-neutral-400" href="https://biasware.com">Biasware.com</a>
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.sidebar-enter-active,
.sidebar-leave-active {
  transition: transform 0.25s ease, opacity 0.2s ease;
}

.sidebar-enter-from,
.sidebar-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
</style>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { RouterLink, useRoute } from 'vue-router';

const props = defineProps<{
  toggleDarkMode: () => void;
}>();

const navLinks = [
  { to: '/', label: 'Overview' },
  { to: '/narrations', label: 'Narrations' },
  { to: '/vaults', label: 'Vaults' },
  { to: '/releases', label: 'Releases' },
  { to: '/about', label: 'About' },
  { to: '/signup', label: 'Account' },
];

const navRef = ref<HTMLElement | null>(null);
const route = useRoute();

const scrollActiveIntoView = () => {
  const navEl = navRef.value;
  if (!navEl) return;

  const activeEl = navEl.querySelector<HTMLAnchorElement>('.nav-link--active');
  if (!activeEl) return;

  const target =
    activeEl.offsetLeft - navEl.clientWidth / 2 + activeEl.offsetWidth / 2;
  const maxScroll = Math.max(navEl.scrollWidth - navEl.clientWidth, 0);
  const clamped = Math.min(Math.max(target, 0), maxScroll);

  navEl.scrollTo({ left: clamped, behavior: 'smooth' });
};

onMounted(() => {
  nextTick(() => {
    scrollActiveIntoView();
  });
});

watch(
  () => route.path,
  () => {
    nextTick(() => {
      scrollActiveIntoView();
    });
  }
);
</script>

<template>
  <div>
    <header
      class="fixed top-0 z-20 block w-full border-b border-neutral-200/40 bg-white/60 backdrop-blur-sm transition-colors dark:border-neutral-800/60 dark:bg-neutral-950/70">
      <nav
        ref="navRef"
        class="nav-scroll container flex flex-nowrap items-center gap-6 overflow-x-auto px-6 py-8 md:justify-around md:overflow-visible md:px-0"
      >
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
            class="nav-link shrink-0 transition-colors"
            :class="[
              isExactActive
                ? 'nav-link--active text-black dark:text-white font-semibold'
                : 'nav-link--inactive text-neutral-500 hover:text-black dark:hover:text-white'
            ]"
          >
            {{ link.label }}
          </a>
        </RouterLink>
      </nav>
    </header>

    <button
      @click="props.toggleDarkMode"
      class="fixed bottom-5 right-5 z-50 rounded-full bg-neutral-400 p-2 text-xs text-neutral-200 transition-colors dark:bg-neutral-800"
      aria-label="Toggle dark mode"
    >
      <Icon icon="carbon:brightness-contrast" class="h-4 w-4" />
    </button>

    <main>
      <slot />
    </main>

    <footer class="bg-neutral-700 pt-16 pb-60 mt-24 text-xs text-neutral-200 dark:bg-neutral-800">
      <div class="container mx-auto grid items-start gap-12 md:grid-cols-6">
        <div class="space-y-4">
          <h2 class="tracking-wide text-neutral-100">Explore</h2>
          <nav class="flex flex-col gap-2 text-neutral-300">
            <RouterLink class="transition-colors hover:text-white" to="/">Overview</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/narrations">Narrations</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/vaults">Vaults</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/releases">Releases</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/about">About</RouterLink>
            <RouterLink class="transition-colors hover:text-white" to="/signup">Account</RouterLink>
          </nav>
        </div>

        <div class="md:col-span-3 space-y-4 leading-relaxed text-neutral-300">
          <h2 class="tracking-wide text-neutral-100">About</h2>
          <p>
            Rugbycodex imagines a shared language for the sport; where video, narration, and context meet.
            We’re building a platform that lets clubs and coaches preserve ideas, experiment with tactics,
            and keep institutional knowledge alive for the next season and beyond. Questions? Reach us at
            <a class="underline transition-colors hover:text-white" href="mailto:contact@biasware.com">contact@biasware.com</a>
          </p>
        </div>

        <div class="md:col-span-2 space-y-4">
          <h2 class="tracking-wide text-neautral-100">Credits</h2>
          <p class="leading-relaxed">
            Built by<br />
            Biasware <a class="text-neutral-400" href="https://biasware.com">Biasware.com</a>
          </p>
          <p class="leading-relaxed">
            Development <br />
            Jose Reyes <a class="text-neutral-400" href="https://biasware.com">@reyesjl</a>
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.nav-scroll {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.nav-scroll::-webkit-scrollbar {
  display: none;
}

@media (max-width: 767px) {
  .nav-scroll {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0%,
      rgba(0, 0, 0, 0.7) 8%,
      rgba(0, 0, 0, 1) 25%,
      rgba(0, 0, 0, 1) 75%,
      rgba(0, 0, 0, 0.7) 92%,
      transparent 100%
    );
    mask-image: linear-gradient(
      to right,
      transparent 0%,
      rgba(0, 0, 0, 0.7) 8%,
      rgba(0, 0, 0, 1) 25%,
      rgba(0, 0, 0, 1) 75%,
      rgba(0, 0, 0, 0.7) 92%,
      transparent 100%
    );
    scroll-padding-inline: 40px;
  }

  .nav-scroll::before,
  .nav-scroll::after {
    content: '';
    flex: 0 0 40px;
    pointer-events: none;
  }
}

@media (min-width: 768px) {
  .nav-scroll {
    -webkit-mask-image: none;
    mask-image: none;
  }
}
</style>

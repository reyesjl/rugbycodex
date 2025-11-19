<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

type DashboardTabRoute = 'DashboardOverview' | 'DashboardAccount';
type DashboardTab = {
  id: string;
  label: string;
  disabled?: boolean;
  routeName?: DashboardTabRoute;
};

const authStore = useAuthStore();
const profileStore = useProfileStore();

const router = useRouter();
const route = useRoute();
const signOutError = ref<string | null>(null);
const signingOut = ref(false);
const currentTime = ref(new Date());
let timeInterval: ReturnType<typeof setInterval> | null = null;

const tabs: DashboardTab[] = [
  { id: 'overview', label: 'Overview', routeName: 'DashboardOverview' },
  { id: 'account', label: 'Account', routeName: 'DashboardAccount' },
  { id: 'narrations', label: 'Narrations', disabled: true },
];

const tabRefs = ref<Record<string, HTMLElement | null>>({});

const setTabRef = (id: string) => (el: Element | ComponentPublicInstance | null) => {
  tabRefs.value[id] = el as HTMLElement | null;
};

const scrollTabIntoView = (id: string) => {
  nextTick(() => {
    const el = tabRefs.value[id];
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
};

const activeRouteName = computed(() => route.name as DashboardTabRoute | undefined);

const handleTabChange = (tab: DashboardTab) => {
  if (!tab.routeName || tab.disabled || tab.routeName === activeRouteName.value) return;
  router.push({ name: tab.routeName });
};

watch(
  activeRouteName,
  (newName) => {
    if (!newName) return;
    const target = tabs.find((tab) => tab.routeName === newName);
    if (target) {
      scrollTabIntoView(target.id);
    }
  },
  { immediate: true }
);

const displayName = computed(() => {
  const metadataName = authStore.user?.user_metadata?.name as string | undefined;
  if (metadataName?.trim()) return metadataName;
  return authStore.user?.email ?? 'Rugbycodex Member';
});

const profileXp = computed(() => Number(profileStore.profile?.xp ?? 0));
const xpDisplay = computed(() => profileXp.value.toLocaleString());
const currentLevel = computed(() => 1);

const greeting = computed(() => {
  const hours = currentTime.value.getHours();
  if (hours < 12) return 'Good morning';
  if (hours < 18) return 'Good afternoon';
  return 'Good evening';
});

const handleSignOut = async () => {
  signingOut.value = true;
  signOutError.value = null;
  const { error } = await authStore.signOut();
  signingOut.value = false;
  if (error) {
    signOutError.value = error.message;
    return;
  }
  router.push({ name: 'Overview' });
};

onMounted(() => {
  timeInterval = setInterval(() => {
    currentTime.value = new Date();
  }, 60_000);
});

onBeforeUnmount(() => {
  if (timeInterval) {
    clearInterval(timeInterval);
    timeInterval = null;
  }
});
</script>

<template>
  <section class="container py-20">
    <div class="flex flex-col">
      <header class="border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-3xl text-neutral-900 dark:text-neutral-100">
              {{ greeting }}, {{ displayName }}!
            </h2>
            <div class="mt-4 flex flex-wrap gap-3 text-sm text-neutral-600 dark:text-neutral-300">
              <span class="rounded-full bg-neutral-100 px-3 py-1 dark:bg-neutral-800/80">
                XP · {{ xpDisplay }}
              </span>
              <span class="rounded-full bg-neutral-100 px-3 py-1 dark:bg-neutral-800/80">
                Level · {{ currentLevel }}
              </span>
            </div>
          </div>
        </div>
      </header>

      <nav class="relative my-5 flex overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/60 no-scrollbar snap-x snap-proximity">
        <div class="tab-strip flex min-w-full gap-1 py-1">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="whitespace-nowrap rounded-lg px-2 text-xs font-semibold uppercase transition snap-center"
            :ref="setTabRef(tab.id)"
            :class="[
              tab.routeName && activeRouteName === tab.routeName
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
              tab.disabled ? 'cursor-not-allowed opacity-50' : ''
            ]"
            :disabled="tab.disabled"
            @click="handleTabChange(tab)"
          >
            {{ tab.label }}
          </button>
          <button
            type="button"
            class="whitespace-nowrap rounded-lg px-2 text-xs font-semibold uppercase text-rose-500 transition hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
            @click="handleSignOut"
            :disabled="signingOut"
            :class="{ 'opacity-50 cursor-not-allowed': signingOut }"
          >
            {{ signingOut ? 'Signing out…' : 'Sign out' }}
          </button>
        </div>
      </nav>

      <p v-if="signOutError" class="text-sm text-rose-500 dark:text-rose-400">
        {{ signOutError }}
      </p>

      <RouterView />
    </div>
  </section>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.tab-strip {
  padding-inline: 0.5rem 1.25rem;
  scroll-padding-inline-start: 0.5rem;
  scroll-padding-inline-end: 1.25rem;
  scroll-snap-type: x mandatory;
}

.tab-strip::after {
  content: '';
  flex: 0 0 1rem;
}
</style>

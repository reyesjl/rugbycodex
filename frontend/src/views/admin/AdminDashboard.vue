<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue';
import { Icon } from '@iconify/vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import Pill from '@/components/ui/Pill.vue';


type SidebarRouteName =
  | 'AdminOverview'
  | 'AdminAccount'
  | 'AdminListOrgs'
  | 'AdminListProfiles'
  | 'AdminNarrations';

const sidebarLinks: Array<{ id: SidebarRouteName; label: string; disabled?: boolean }> = [
  { id: 'AdminOverview', label: 'Overview' },
  { id: 'AdminAccount', label: 'Account' },
  { id: 'AdminListOrgs', label: 'Organizations' },
  { id: 'AdminListProfiles', label: 'Members' },
  { id: 'AdminNarrations', label: 'Narrations', disabled: true },
];

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const signOutError = ref<string | null>(null);
const signingOut = ref(false);
const currentTime = ref(new Date());
let timeInterval: ReturnType<typeof setInterval> | null = null;
const tabRefs = ref<Record<SidebarRouteName, HTMLElement | null>>({
  AdminOverview: null,
  AdminAccount: null,
  AdminListOrgs: null,
  AdminListProfiles: null,
  AdminNarrations: null,
});

const displayName = computed(() => {
  const metadataName = authStore.user?.user_metadata?.name as string | undefined;
  if (metadataName?.trim()) return metadataName;
  return authStore.user?.email ?? 'Member';
});

const activeRouteName = computed(() => route.name as string | undefined);

const greeting = computed(() => {
  const hours = currentTime.value.getHours();
  if (hours < 12) return 'Good morning';
  if (hours < 18) return 'Good afternoon';
  return 'Good evening';
});

const setTabRef = (id: SidebarRouteName) => (el: Element | ComponentPublicInstance | null) => {
  tabRefs.value[id] = el as HTMLElement | null;
};

const scrollTabIntoView = (id: SidebarRouteName) => {
  nextTick(() => {
    const el = tabRefs.value[id];
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
};

const handlePanelChange = (panelId: SidebarRouteName) => {
  if (panelId === activeRouteName.value || sidebarLinks.find(link => link.id === panelId)?.disabled) {
    return;
  }

  router.push({ name: panelId });
  scrollTabIntoView(panelId);
};

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

watch(
  activeRouteName,
  (newName) => {
    if (!newName) return;
    if (sidebarLinks.some(link => link.id === newName)) {
      scrollTabIntoView(newName as SidebarRouteName);
    }
  },
  { immediate: true }
);

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
          </div>
          <div class="flex items-center">
            <Pill variant="success">InDev</Pill>
            <Icon icon="mdi:dot" class="h-3 w-3 text-black dark:text-white" />
            <div class="shrink-0 text-sm text-blue-500 dark:text-blue-300">Feedback</div>
          </div>
        </div>
      </header>

      <nav
        class="relative flex overflow-x-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950/60 no-scrollbar snap-x snap-proximity my-5">
        <div class="px-2 flex min-w-full gap-1 py-1">
          <button v-for="item in sidebarLinks" :key="item.id" type="button"
            class="whitespace-nowrap px-2 text-xs font-semibold uppercase transition snap-center"
            :ref="setTabRef(item.id)" :class="[
              item.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            ]" :disabled="item.disabled" @click="handlePanelChange(item.id)">
            <span :class="[
              'inline-block',
              activeRouteName === item.id
                ? 'border-b-2 border-black text-black dark:border-white dark:text-white'
                : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            ]">
              {{ item.label }}
            </span>
          </button>
          <button type="button"
            class="whitespace-nowrap cursor-pointer rounded-lg px-2 text-xs font-semibold uppercase text-rose-500 transition hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
            @click="handleSignOut" :disabled="signingOut" :class="{ 'opacity-50 cursor-not-allowed': signingOut }">
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

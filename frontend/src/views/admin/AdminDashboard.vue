<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

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

const isSidebarOpen = ref(true);

const signOutError = ref<string | null>(null);
const signingOut = ref(false);

const displayName = computed(() => {
  const metadataName = authStore.user?.user_metadata?.name as string | undefined;
  if (metadataName?.trim()) return metadataName;
  return authStore.user?.email ?? 'Member';
});

const activeRouteName = computed(() => route.name as string | undefined);

const isOverviewPanel = computed(() => activeRouteName.value === 'AdminOverview');

const currentPanelLabel = computed(() => {
  if (isOverviewPanel.value) return 'Overview';

  const activeName = activeRouteName.value;
  if (!activeName) {
    return (route.meta?.adminLabel as string | undefined) ?? '';
  }
  return sidebarLinks.find(link => link.id === activeName)?.label ?? (route.meta?.adminLabel as string | undefined) ?? '';
});

const currentPanelDescription = computed(() => {
  const descriptionOverride = route.meta?.adminDescription as string | undefined;
  if (descriptionOverride) return descriptionOverride;

  if (!isOverviewPanel.value && currentPanelLabel.value) {
    return `Manage ${currentPanelLabel.value.toLowerCase()} from your admin command center.`;
  }
  return '';
});

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const handlePanelChange = (panelId: SidebarRouteName) => {
  if (panelId === activeRouteName.value || sidebarLinks.find(link => link.id === panelId)?.disabled) {
    return;
  }

  router.push({ name: panelId });

  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    isSidebarOpen.value = false;
  }
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
</script>

<template>
  <section class="container-lg py-20">
    <div class="flex flex-col gap-6">
      <div class="flex justify-end">
        <button
          type="button"
          class="inline-flex items-center gap-3 rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-200 dark:hover:border-neutral-100 dark:hover:text-neutral-100"
          @click="toggleSidebar"
        >
          <Icon :icon="isSidebarOpen ? 'carbon:close' : 'carbon:menu'" class="h-5 w-5" />
          <span>{{ isSidebarOpen ? 'Close menu' : 'Open menu' }}</span>
        </button>
      </div>

      <div class="flex flex-col gap-12 lg:flex-row lg:items-start">
        <Transition name="sidebar-slide">
          <aside
            v-if="isSidebarOpen"
            class="p-8 text-base lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] lg:w-64 lg:overflow-y-auto lg:self-start"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.4em] text-neutral-500 dark:text-neutral-500">
              Admin
            </p>
            <nav class="mt-8 flex flex-col gap-3 text-lg font-medium">
              <button
                v-for="item in sidebarLinks"
                :key="item.id"
                type="button"
                class="pl-2 text-left text-neutral-500 transition hover:text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100"
                :class="activeRouteName === item.id
                  ? 'text-neutral-900 dark:text-white'
                  : ''"
                :disabled="item.disabled"
                @click="handlePanelChange(item.id)"
              >
                {{ item.label }}
                <span
                  v-if="item.disabled"
                  class="ml-2 inline-flex items-center rounded-full bg-neutral-200 px-2 py-0.5 text-xs uppercase tracking-[0.3em] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  Soon
                </span>
              </button>
            </nav>
            <button
              type="button"
              class="mt-10 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              @click="handleSignOut"
              :disabled="signingOut"
              :class="{ 'opacity-50': signingOut }"
            >
              {{ signingOut ? 'Signing out…' : 'Sign out' }}
            </button>
            <p v-if="signOutError" class="mt-3 text-sm text-rose-500 dark:text-rose-400">
              {{ signOutError }}
            </p>
          </aside>
        </Transition>

        <div class="flex-1 space-y-12">
          <header class="border-b border-neutral-200 pb-10 dark:border-neutral-800">
            <template v-if="isOverviewPanel">
              <h1 class="text-4xl font-semibold text-neutral-900 dark:text-neutral-100">
                Welcome back, {{ displayName }}.
              </h1>
              <p class="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-400">
                Keep tabs on accounts, organizations, and narrations without the extra chrome.
              </p>
            </template>
            <template v-else>
              <p class="text-xs font-semibold uppercase tracking-[0.4em] text-neutral-500 dark:text-neutral-500">
                Admin
              </p>
              <h1 class="mt-4 text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
                {{ currentPanelLabel }}
              </h1>
              <p v-if="currentPanelDescription" class="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-400">
                {{ currentPanelDescription }}
              </p>
            </template>
          </header>

          <RouterView />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: all 0.3s ease;
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  opacity: 0;
  transform: translateX(-2rem);
}
</style>

<script setup lang="ts">
import { computed, markRaw, onMounted, ref, type Component } from 'vue';
import { Icon } from '@iconify/vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getDashboardStats, type DashboardStats } from '@/services/stats_service';
import { getTopMembersByXp, type MemberLeaderboardEntry } from '@/services/profile_service';
import SettingsPanel from '@/views/Settings.vue';
import AdminListOrgs from '@/views/admin/AdminListOrgs.vue';
import AdminListProfiles from '@/views/admin/AdminListProfiles.vue';
import AnimatedLink from '@/components/AnimatedLink.vue';

type SidebarPanelId = 'overview' | 'account' | 'organizations' | 'members' | 'narrations';

const sidebarLinks: Array<{ id: SidebarPanelId; label: string; disabled?: boolean }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'account', label: 'Account' },
  { id: 'organizations', label: 'Organizations' },
  { id: 'members', label: 'Members' },
  { id: 'narrations', label: 'Narrations', disabled: true },
];

const panelComponents: Record<SidebarPanelId, Component | null> = {
  overview: null,
  account: markRaw(SettingsPanel),
  organizations: markRaw(AdminListOrgs),
  members: markRaw(AdminListProfiles),
  narrations: null,
};

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const defaultPanel: SidebarPanelId = 'overview';

const isSidebarOpen = ref(true);

const signOutError = ref<string | null>(null);
const signingOut = ref(false);
const stats = ref<DashboardStats | null>(null);
const statsLoading = ref(true);
const statsError = ref<string | null>(null);
const topMembers = ref<MemberLeaderboardEntry[]>([]);
const membersLoading = ref(true);
const membersError = ref<string | null>(null);

const displayName = computed(() => {
  const metadataName = authStore.user?.user_metadata?.name as string | undefined;
  if (metadataName?.trim()) return metadataName;
  return authStore.user?.email ?? 'Member';
});

const isValidPanelId = (panel: string): panel is SidebarPanelId => {
  return sidebarLinks.some(link => link.id === panel);
};

const activePanel = computed<SidebarPanelId>(() => {
  const queryPanel = route.query.panel;
  if (typeof queryPanel === 'string' && isValidPanelId(queryPanel)) {
    return queryPanel;
  }
  return defaultPanel;
});

const currentPanelComponent = computed<Component | null>(() => {
  return panelComponents[activePanel.value];
});

const currentPanelLabel = computed(() => sidebarLinks.find(link => link.id === activePanel.value)?.label ?? '');

const isOverviewPanel = computed(() => activePanel.value === 'overview');

const isNarrationsPanel = computed(() => activePanel.value === 'narrations');

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const handlePanelChange = (panelId: SidebarPanelId) => {
  if (panelId === activePanel.value || sidebarLinks.find(link => link.id === panelId)?.disabled) {
    return;
  }

  const nextQuery = { ...route.query };
  if (panelId === defaultPanel) {
    delete nextQuery.panel;
  } else {
    nextQuery.panel = panelId;
  }

  router.replace({ query: nextQuery });

  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    isSidebarOpen.value = false;
  }
};

const statColumns = computed(() => {
  if (!stats.value) return [];

  return [
    { id: 'organizations', label: 'Organizations', description: 'Active orgs', value: stats.value.organizations },
    { id: 'members', label: 'Members', description: 'Profiles on file', value: stats.value.members },
    { id: 'narrations', label: 'Narrations', description: 'Stories shared', value: stats.value.narrations },
    { id: 'uploads', label: 'Uploads', description: 'Media assets', value: stats.value.uploads },
  ];
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

const loadDashboardData = async () => {
  statsLoading.value = true;
  membersLoading.value = true;
  statsError.value = null;
  membersError.value = null;

  const [statsResult, membersResult] = await Promise.allSettled([
    getDashboardStats(),
    getTopMembersByXp(10),
  ]);

  if (statsResult.status === 'fulfilled') {
    stats.value = statsResult.value;
  } else {
    statsError.value =
      statsResult.reason instanceof Error ? statsResult.reason.message : 'Failed to load dashboard stats.';
  }
  statsLoading.value = false;

  if (membersResult.status === 'fulfilled') {
    topMembers.value = membersResult.value;
  } else {
    membersError.value =
      membersResult.reason instanceof Error ? membersResult.reason.message : 'Failed to load member list.';
  }
  membersLoading.value = false;
};

onMounted(() => {
  loadDashboardData();
});
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
                :class="activePanel === item.id
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
              <p v-if="currentPanelLabel" class="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-400">
                Manage {{ currentPanelLabel.toLowerCase() }} from your admin command center.
              </p>
            </template>
          </header>

          <template v-if="isOverviewPanel">
            <section>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.4em] text-neutral-500 dark:text-neutral-500">
                    Overview
                  </p>
                  <h2 class="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                    Platform pulse
                  </h2>
                </div>
                <button
                  type="button"
                  class="self-start text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                  @click="loadDashboardData"
                  :disabled="statsLoading || membersLoading"
                  :class="{ 'opacity-50 cursor-not-allowed': statsLoading || membersLoading }"
                >
                  Refresh
                </button>
              </div>

              <div class="mt-8 min-h-[200px]">
                <p v-if="statsLoading" class="text-neutral-500 dark:text-neutral-400">Loading insights…</p>
                <p v-else-if="statsError" class="text-sm text-rose-500 dark:text-rose-400">{{ statsError }}</p>
                <div v-else class="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
                  <article v-for="stat in statColumns" :key="stat.id" class="flex flex-col gap-2">
                    <p class="text-xs font-semibold uppercase tracking-[0.4em] text-neutral-500 dark:text-neutral-400">
                      {{ stat.label }}
                    </p>
                    <div class="text-5xl font-semibold text-neutral-900 dark:text-neutral-100">
                      {{ stat.value.toLocaleString() }}
                    </div>
                    <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ stat.description }}</p>
                  </article>
                </div>
              </div>
            </section>

            <section>
              <div
                class="flex flex-col gap-2 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between"
              >
                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.4em] text-neutral-500 dark:text-neutral-500">
                    Members
                  </p>
                  <h2 class="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                    XP leaderboard
                  </h2>
                </div>
                <button
                  type="button"
                  class="self-start text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                  @click="handlePanelChange('members')"
                >
                  View all
                </button>
              </div>

              <div class="mt-6">
                <p v-if="membersLoading" class="text-neutral-500 dark:text-neutral-400">Loading members…</p>
                <p v-else-if="membersError" class="text-sm text-rose-500 dark:text-rose-400">{{ membersError }}</p>
                <p v-else-if="topMembers.length === 0" class="text-neutral-500 dark:text-neutral-400">
                  No members to display.
                </p>
                <div v-else class="overflow-x-auto">
                  <table class="min-w-full text-left text-sm">
                    <thead class="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                      <tr>
                        <th class="py-3 pr-6 font-semibold">Rank</th>
                        <th class="py-3 pr-6 font-semibold">Member</th>
                        <th class="py-3 pr-6 font-semibold">XP</th>
                        <th class="py-3 pr-6 font-semibold">Orgs</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(member, index) in topMembers"
                        :key="member.id"
                        class="border-b border-neutral-200 text-neutral-900 dark:border-neutral-800 dark:text-neutral-100"
                      >
                        <td class="py-4 pr-6 text-xs font-semibold text-neutral-500 dark:text-neutral-500">
                          {{ String(index + 1).padStart(2, '0') }}
                        </td>
                        <td class="py-4 pr-6 font-medium">
                          <AnimatedLink :to="`/admin/profiles/${member.id}`" :text="member.name" />
                        </td>
                        <td class="py-4 pr-6 font-semibold tracking-tight">
                          {{ member.xp.toLocaleString() }}
                        </td>
                        <td class="py-4 pr-6 font-medium">
                          {{ member.orgCount }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </template>
          <component v-else-if="currentPanelComponent" :is="currentPanelComponent" />
          <div
            v-else-if="isNarrationsPanel"
            class="rounded-3xl border border-dashed border-neutral-300/70 p-10 text-center text-neutral-600 dark:border-neutral-800 dark:text-neutral-400"
          >
            Narrations tooling is coming soon.
          </div>
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

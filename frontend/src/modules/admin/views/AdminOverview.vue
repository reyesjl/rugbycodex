<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AnimatedLink from '@/components/AnimatedLink.vue';
import RefreshButton from '@/components/RefreshButton.vue';
import { getDashboardStats } from '@/modules/admin/services/stats_service';
import type { DashboardStats } from '@/modules/admin/types';
import type { MemberLeaderboardEntry } from '@/modules/profiles/types';
import { profileService } from '@/modules/profiles/services/ProfileService';

const router = useRouter();

const stats = ref<DashboardStats | null>(null);
const statsLoading = ref(true);
const statsError = ref<string | null>(null);
const topMembers = ref<MemberLeaderboardEntry[]>([]);
const membersLoading = ref(true);
const membersError = ref<string | null>(null);

const statColumns = computed(() => {
  if (!stats.value) return [];

  return [
    { id: 'organizations', label: 'Orgs', description: 'Active orgs', value: stats.value.organizations },
    { id: 'members', label: 'Members', description: 'Profiles on file', value: stats.value.members },
    { id: 'narrations', label: 'Narrations', description: 'Stories shared', value: stats.value.narrations },
    { id: 'uploads', label: 'Uploads', description: 'Media assets', value: stats.value.uploads },
  ];
});

const loadDashboardData = async () => {
  statsLoading.value = true;
  membersLoading.value = true;
  statsError.value = null;
  membersError.value = null;

  const [statsResult, membersResult] = await Promise.allSettled([
    getDashboardStats(),
    profileService.leaderboard.topMembers(10),
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

const handleViewAllMembers = () => {
  router.push({ name: 'AdminListProfiles' });
};

onMounted(() => {
  loadDashboardData();
});
</script>

<template>
  <section class="space-y-12">
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
        <RefreshButton class="self-start" :refresh="loadDashboardData" :loading="statsLoading || membersLoading"
          title="Refresh dashboard data">
        </RefreshButton>
      </div>

      <div class="mt-8 min-h-[200px]">
        <p v-if="statsLoading" class="text-neutral-500 dark:text-neutral-400">Loading insights…</p>
        <p v-else-if="statsError" class="text-sm text-rose-500 dark:text-rose-400">{{ statsError }}</p>
        <div v-else class="relative -mx-4 px-4">
          <div class="stat-strip flex gap-4 overflow-x-auto py-2 no-scrollbar md:flex-wrap">
            <article v-for="stat in statColumns" :key="stat.id"
              class="flex snap-start flex-col gap-2 border border-neutral-200 bg-neutral-50/90 px-4 py-6 text-neutral-900 shadow-[0_10px_30px_rgba(0,0,0,0.05)] dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-100 dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] md:flex-1 md:snap-none">
              <p class="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                {{ stat.label }}
              </p>
              <div class="text-5xl font-semibold text-neutral-900 dark:text-neutral-100">
                {{ stat.value.toLocaleString() }}
              </div>
              <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ stat.description }}</p>
            </article>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div
        class="flex flex-col gap-2 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.4em] text-neutral-500 dark:text-neutral-500">
            Members
          </p>
          <h2 class="mt-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            XP leaderboard
          </h2>
        </div>
        <button type="button"
          class="self-start text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          @click="handleViewAllMembers">
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
              <tr v-for="(member, index) in topMembers" :key="member.id"
                class="border-b border-neutral-200 text-neutral-900 dark:border-neutral-800 dark:text-neutral-100">
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
  </section>
</template>

<style scoped>
.stat-strip {
  scroll-snap-type: x mandatory;
  padding-inline: 0.5rem;
}

.stat-strip>article {
  scroll-snap-align: center;
}

@media (min-width: 768px) {
  .stat-strip {
    scroll-snap-type: none;
    overflow-x: visible;
    padding-inline: 0;
  }
}
</style>


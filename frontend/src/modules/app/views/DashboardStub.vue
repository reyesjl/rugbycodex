<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useProfileStore } from '@/modules/profiles/stores/useProfileStore';
import type { OrgMembership } from '@/modules/profiles/types';
import { useDashboardVariant, type DashboardVariant } from '@/modules/app/composables/useDashboardVariant';
import DashboardAdminPanel from '@/modules/app/components/dashboard/DashboardAdminPanel.vue';
import DashboardOrgLeaderPanel from '@/modules/app/components/dashboard/DashboardOrgLeaderPanel.vue';
import DashboardOrgMemberPanel from '@/modules/app/components/dashboard/DashboardOrgMemberPanel.vue';
import DashboardGettingStartedPanel from '@/modules/app/components/dashboard/DashboardGettingStartedPanel.vue';

type OrgLinks = {
  overview: string;
  media: string;
  members: string;
  settings: string;
};

const profileStore = useProfileStore();
const { profile } = storeToRefs(profileStore);
const { variant, primaryMembership, membershipCount } = useDashboardVariant();

const profileName = computed(() => profile.value?.name ?? 'there');

const orgLinks = computed<OrgLinks | null>(() => {
  const membership = primaryMembership.value;
  if (!membership) {
    return null;
  }
  const base = membership.slug ? `/v2/orgs/${membership.slug}` : `/v2/orgs/${membership.org_id}`;
  return {
    overview: `${base}/overview`,
    media: `${base}/media`,
    members: `${base}/members`,
    settings: `${base}/settings`,
  } satisfies OrgLinks;
});

const welcomeCopy = computed(() => {
  switch (variant.value) {
    case 'admin':
      return 'System health, moderation, and cross-org actions in one place.';
    case 'orgLeader':
      return 'Review your org pulse, unblock staff, and monitor storage + sessions.';
    case 'orgContributor':
      return 'Pick up your next assignment or review recently shared footage.';
    default:
      return 'Spin up an organization to unlock tagging, narrations, and vaults.';
  }
});

const componentRegistry: Record<DashboardVariant, unknown> = {
  admin: DashboardAdminPanel,
  orgLeader: DashboardOrgLeaderPanel,
  orgContributor: DashboardOrgMemberPanel,
  noOrg: DashboardGettingStartedPanel,
};

const variantComponent = computed(() => componentRegistry[variant.value]);

const variantProps = computed(() => ({
  profileName: profileName.value,
  membership: primaryMembership.value as OrgMembership | null,
  orgLinks: orgLinks.value,
  membershipCount: membershipCount.value,
}));
</script>

<template>
  <div class="container space-y-8 py-6 pb-50">
    <header>
      <!-- <p class="text-sm uppercase tracking-wide text-white/50">Dashboard</p> -->
      <div class="text-white text-2xl font-semibold">
        Welcome back, {{ profileName }}
      </div>
      <p class="mt-1 text-white/70">{{ welcomeCopy }}</p>
    </header>

    <div class="rounded border border-white/20 bg-black/30 p-4">
      <form class="h-12">
        <input
          type="text"
          placeholder="Find anything"
          class="w-full rounded border border-white/20 bg-black/20 p-2 text-white placeholder:text-white/40 focus:outline-none"
        />
      </form>
      <div class="mt-4 flex items-center justify-between gap-3 px-1">
        <RouterLink to="/v2/marketing" class="rounded-sm bg-white/10 p-2 text-xs font-medium text-white hover:bg-white/20">
          Learn how to find rugby players, actions, & events.
        </RouterLink>
        <button
          type="button"
          class="flex shrink-0 items-center justify-center rounded-full p-2 transition hover:bg-white/10"
        >
          <Icon icon="carbon:send" width="20" height="20" class="text-white" />
        </button>
      </div>
    </div>

    <component
      v-if="variantComponent"
      :is="variantComponent"
      v-bind="variantProps"
    />
    <div v-else class="rounded border border-white/20 bg-black/30 p-6 text-white/70">
      Loading personalized dashboard...
    </div>
  </div>
</template>

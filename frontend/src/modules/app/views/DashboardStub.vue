<script setup lang="ts">
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

const profileName = computed(() => profile.value?.username ?? profile.value?.name ?? 'there');

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
    </header>

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

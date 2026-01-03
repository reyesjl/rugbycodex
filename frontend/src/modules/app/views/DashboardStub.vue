<script setup lang="ts">
import { useDashboardState } from '@/modules/app/composables/useDashboardState';

import DashboardSkeleton from '@/modules/app/components/dashboard/DashboardSkeleton.vue';
import DashboardAdminPanel from '@/modules/app/components/dashboard/DashboardAdminPanel.vue';
import DashboardOrgLeaderPanel from '@/modules/app/components/dashboard/DashboardOrgLeaderPanel.vue';
import DashboardOrgMemberPanel from '@/modules/app/components/dashboard/DashboardOrgMemberPanel.vue';
import DashboardGettingStartedPanel from '@/modules/app/components/dashboard/DashboardGettingStartedPanel.vue';

const { variant, orgCount } = useDashboardState();
</script>

<template>
  <div class="container space-y-8 py-6 pb-50">
    <DashboardSkeleton v-if="variant === 'booting'" />

    <DashboardAdminPanel
      v-else-if="variant === 'admin'"
      :org-count="orgCount"
    />

    <DashboardGettingStartedPanel
      v-else-if="variant === 'onboarding'"
      :org-count="orgCount"
    />

    <DashboardOrgLeaderPanel
      v-else-if="variant === 'orgLeader'"
    />

    <DashboardOrgMemberPanel
      v-else-if="variant === 'orgContributor'"
    />
  </div>
</template>


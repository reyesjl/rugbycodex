<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore';
import DashboardGettingStartedPanel from '@/modules/app/components/dashboard/DashboardGettingStartedPanel.vue';
import DashboardSkeleton from '@/modules/app/components/dashboard/DashboardSkeleton.vue';

const router = useRouter();
const authStore = useAuthStore();
const myOrgs = useMyOrganizationsStore();

const { isAdmin, isAuthenticated } = storeToRefs(authStore);
const { loaded, hasOrganizations } = storeToRefs(myOrgs);

onMounted(() => {
  if (isAuthenticated.value && !loaded.value) {
    void myOrgs.load();
  }
});

watch(
  [loaded, hasOrganizations, isAdmin],
  ([isLoaded, hasOrgs, admin]) => {
    if (!isLoaded) return;

    // Behavior change: onboarding is only visible when the user has zero orgs.
    if (admin) {
      void router.replace({ name: 'AdminOrgs' });
      return;
    }

    if (hasOrgs) {
      void router.replace({ name: 'MyRugby' });
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="container space-y-8 py-6 pb-50">
    <DashboardSkeleton v-if="!loaded" />

    <DashboardGettingStartedPanel v-else-if="!hasOrganizations && !isAdmin" />
  </div>
</template>

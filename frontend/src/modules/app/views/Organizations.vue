<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { onMounted, ref, watch } from 'vue';
import { orgService } from '@/modules/orgs/services/orgServiceV2';
import type { UserOrganizationSummary } from '@/modules/orgs/types/UserOrganizationSummary';
import JoinOrgModal from '@/modules/orgs/components/JoinOrgModal.vue';
import MyOrganizationsSection from '@/modules/app/components/organizations/MyOrganizationsSection.vue';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useRoute, useRouter } from 'vue-router';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const myOrganizations = ref<UserOrganizationSummary[]>([]);
const myLoading = ref(true);
const myError = ref<string | null>(null);

// Show join modal
const showJoin = ref(false);

const handleJoinClick = async () => {
  if (authStore.isAuthenticated) {
    showJoin.value = true;
    return;
  }

  await router.push({
    name: 'Login',
    query: {
      redirect: '/organizations?join=1',
    },
  });
};

const loadMyOrganizations = async () => {
  myLoading.value = true;
  myError.value = null;
  try {
    myOrganizations.value = await orgService.listUserOrganizations();
  } catch (err) {
    myError.value = err instanceof Error ? err.message : 'Failed to load your organizations.';
  } finally {
    myLoading.value = false;
  }
};

onMounted(() => {
  if (authStore.isAuthenticated) {
    loadMyOrganizations();
  }
});

watch(
  () => authStore.isAuthenticated,
  (isAuthed) => {
    if (isAuthed && myOrganizations.value.length === 0 && !myLoading.value) {
      loadMyOrganizations();
    }

    if (isAuthed && route.query.join === '1') {
      showJoin.value = true;
      router.replace({ query: { ...route.query, join: undefined } });
    }
  }
);

onMounted(() => {
  if (authStore.isAuthenticated && route.query.join === '1') {
    showJoin.value = true;
    router.replace({ query: { ...route.query, join: undefined } });
  }
});
</script>

<template>
  <JoinOrgModal v-if="showJoin" @close="showJoin = false" />
  <section class="container space-y-6 py-5 text-white">
    <header class="space-y-1">
      <div class="flex md:flex-row flex-col items-center justify-between">
        <div class="mb-8 md:mb-0">
          <h1 class="text-3xl">Your Organizations</h1>
          <p class="text-white/70">
            Join with a code or build a new organization.
          </p>
        </div>

        <div class="flex gap-3">
          <button
            @click="handleJoinClick"
            class="flex gap-2 items-center rounded-lg px-2 py-1 border border-sky-500 bg-sky-500/70 hover:bg-sky-700/70 text-xs cursor-pointer transition">
            <Icon icon="carbon:join-left-outer" width="15" height="15" />
            <div>Join with code</div>
          </button>

          <RouterLink
            to="/organizations/create"
            class="flex gap-2 items-center rounded-lg px-2 py-1 border border-green-500 bg-green-500/70 hover:bg-green-700/70 text-xs transition">
            <Icon icon="carbon:add" width="15" height="15" />
            <div>New organization</div>
          </RouterLink>
        </div>
      </div>
    </header>

    <MyOrganizationsSection
      v-if="authStore.isAuthenticated"
      :organizations="myOrganizations"
      :loading="myLoading"
      :error="myError"
    />
  </section>
</template>

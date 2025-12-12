<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { storeToRefs } from 'pinia';
import RefreshButton from '@/components/RefreshButton.vue';
import { useOrganizationList } from '@/modules/orgs/composables/useOrganizationsList';
import { organizationRequestService } from '@/modules/orgs/services/organizationRequestService';
import type { Organization } from '@/modules/orgs/types';
import type { OrgMembership } from '@/modules/profiles/types';
import { useProfileStore } from '@/modules/profiles/stores/useProfileStore';

type FilterMode = 'all' | 'mine';
type JoinState = 'idle' | 'pending' | 'requested' | 'error';

const orgList = useOrganizationList();
const profileStore = useProfileStore();
const { memberships, loadingProfile } = storeToRefs(profileStore);

const searchQuery = ref('');
const filterMode = ref<FilterMode>('all');

const showCreateModal = ref(false);
const createOrgName = ref('');
const createOrgSlug = ref('');
const createOrgNotes = ref('');
const slugManuallyEdited = ref(false);
const createRequestError = ref<string | null>(null);
const createRequestLoading = ref(false);

const joinRequestState = ref<Record<string, JoinState>>({});
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null);
let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

const memberOrgMap = computed<Record<string, OrgMembership>>(() =>
  memberships.value.reduce<Record<string, OrgMembership>>((acc, membership) => {
    acc[membership.org_id] = membership;
    return acc;
  }, {})
);

const isMember = (orgId: string) => memberOrgMap.value[orgId] !== undefined;
const membershipForOrg = (orgId: string) => memberOrgMap.value[orgId] ?? null;

const organizationRoute = (org: Organization) => `/v2/orgs/${org.slug}/overview`;

const formatDate = (date?: Date | null) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const createSlugFromName = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

const filteredOrgs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return orgList.organizations.value.filter((org) => {
    if (filterMode.value === 'mine' && !isMember(org.id)) {
      return false;
    }
    if (!query) return true;
    return org.name.toLowerCase().includes(query) || org.slug.toLowerCase().includes(query);
  });
});

const isBusy = computed(() => orgList.loading.value || loadingProfile.value);

const canSubmitCreate = computed(() => {
  return Boolean(createOrgName.value.trim()) && Boolean(createOrgSlug.value.trim()) && !createRequestLoading.value;
});

const getJoinState = (orgId: string): JoinState => joinRequestState.value[orgId] ?? 'idle';

const joinButtonText = (orgId: string) => {
  const state = getJoinState(orgId);
  if (state === 'pending') return 'Requesting…';
  if (state === 'requested') return 'Requested';
  if (state === 'error') return 'Retry join';
  return 'Join';
};

const joinButtonDisabled = (orgId: string) => {
  const state = getJoinState(orgId);
  return state === 'pending' || state === 'requested';
};

const joinButtonTone = (orgId: string) =>
  getJoinState(orgId) === 'error'
    ? 'border border-rose-300/70 text-rose-200 hover:border-rose-200 hover:text-rose-50'
    : 'border border-white/30 text-white/80 hover:border-white hover:bg-white hover:text-black';

const resetFeedbackTimer = () => {
  if (feedbackTimer) {
    if (typeof window !== 'undefined') {
      window.clearTimeout(feedbackTimer);
    } else {
      clearTimeout(feedbackTimer);
    }
    feedbackTimer = null;
  }
};

const setFeedback = (text: string, type: 'success' | 'error' = 'success') => {
  feedback.value = { text, type };
  resetFeedbackTimer();
  const timer = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
  feedbackTimer = timer(() => {
    feedback.value = null;
    feedbackTimer = null;
  }, 6000);
};

const resetCreateForm = () => {
  createOrgName.value = '';
  createOrgSlug.value = '';
  createOrgNotes.value = '';
  slugManuallyEdited.value = false;
  createRequestError.value = null;
};

const openCreateModal = () => {
  resetCreateForm();
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  if (createRequestLoading.value) return;
  showCreateModal.value = false;
  resetCreateForm();
};

const handleRefresh = async () => {
  await orgList.loadOrganizations();
};

const handleJoinRequest = async (org: Organization) => {
  if (isMember(org.id)) return;
  const currentState = getJoinState(org.id);
  if (currentState === 'pending') return;
  joinRequestState.value = { ...joinRequestState.value, [org.id]: 'pending' };
  try {
    await organizationRequestService.requestJoin({ orgId: org.id });
    joinRequestState.value = { ...joinRequestState.value, [org.id]: 'requested' };
    setFeedback(`Request sent to join ${org.name}. We'll let you know once it's approved.`);
  } catch (error) {
    joinRequestState.value = { ...joinRequestState.value, [org.id]: 'error' };
    const message = error instanceof Error ? error.message : 'Unable to send join request right now.';
    setFeedback(message, 'error');
  }
};

const handleCreateRequest = async () => {
  if (!canSubmitCreate.value) return;
  createRequestError.value = null;
  createRequestLoading.value = true;
  const name = createOrgName.value.trim();
  const slug = createOrgSlug.value.trim();
  const description = createOrgNotes.value.trim();
  try {
    await organizationRequestService.requestCreate({
      name,
      slug,
      description: description || undefined,
    });
    showCreateModal.value = false;
    setFeedback(`Request submitted for ${name}. We'll review it shortly.`);
    resetCreateForm();
  } catch (error) {
    createRequestError.value = error instanceof Error ? error.message : 'Unable to submit your request.';
  } finally {
    createRequestLoading.value = false;
  }
};

onMounted(async () => {
  await orgList.loadOrganizations();
});

onBeforeUnmount(() => {
  resetFeedbackTimer();
});

watch(createOrgName, (name) => {
  if (slugManuallyEdited.value) return;
  createOrgSlug.value = createSlugFromName(name);
});
</script>

<template>
  <section class="container-lg space-y-6 py-5 text-white">
    <header class="space-y-1">
      <h1 class="text-3xl font-semibold">Organizations</h1>
      <p class="text-white/70">
        Discover clubs on Rugbycodex, request to join them, or ask us to spin up a brand new workspace.
      </p>
    </header>

    <div class="flex flex-col gap-4 rounded border border-white/10 bg-white/5 p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="relative w-full md:max-w-md">
          <Icon icon="carbon:search" class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search by organization name or slug"
            class="w-full rounded border border-white/20 bg-black/40 py-3 pl-12 pr-4 text-white placeholder:text-white/40 focus:border-white focus:outline-none"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex overflow-hidden rounded border border-white/20 text-xs font-semibold uppercase tracking-wide">
            <button
              type="button"
              class="px-4 py-2 transition"
              :class="filterMode === 'all' ? 'bg-white text-black' : 'text-white/70 hover:text-white'"
              @click="filterMode = 'all'"
            >
              All orgs
            </button>
            <button
              type="button"
              class="px-4 py-2 transition"
              :class="filterMode === 'mine' ? 'bg-white text-black' : 'text-white/70 hover:text-white'"
              @click="filterMode = 'mine'"
            >
              My orgs
            </button>
          </div>
          <button
            type="button"
            class="flex items-center gap-2 rounded border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-black"
            @click="openCreateModal"
          >
            <Icon icon="carbon:add" class="h-4 w-4" />
            Request new org
          </button>
          <RefreshButton size="sm" :refresh="handleRefresh" :loading="orgList.loading.value" title="Refresh organizations" />
        </div>
      </div>

      <div v-if="feedback" class="rounded border px-3 py-2 text-sm" :class="feedback.type === 'success' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-rose-400/40 bg-rose-500/10 text-rose-100'">
        {{ feedback.text }}
      </div>

      <div v-if="isBusy" class="rounded border border-white/15 bg-black/30 p-4 text-white/70">
        Loading organizations…
      </div>

      <div v-else-if="orgList.error.value" class="rounded border border-rose-400/40 bg-rose-500/10 p-4 text-white">
        <p class="font-semibold">{{ orgList.error.value }}</p>
        <p class="text-sm text-white/80">Try refreshing or check back later.</p>
      </div>

      <div v-else>
        <div v-if="filteredOrgs.length === 0" class="rounded border border-white/10 px-4 py-10 text-center text-white/70">
          {{
            searchQuery
              ? 'No organizations match your search.'
              : filterMode === 'mine'
                ? "You're not a member of any organizations yet."
                : 'No organizations available yet.'
          }}
        </div>
        <div
          v-else
          class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <article
            v-for="org in filteredOrgs"
            :key="org.id"
            class="group flex flex-col rounded border border-white/10 bg-black/30 p-4 shadow-lg transition hover:border-white/30 hover:bg-white/5"
          >
            <RouterLink
              :to="organizationRoute(org)"
              class="flex flex-1 flex-col gap-2"
            >
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-lg font-semibold group-hover:text-white">
                  {{ org.name }}
                </h3>
                <span
                  class="rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide"
                  :class="isMember(org.id) ? 'border-emerald-300/50 text-emerald-200' : 'border-white/30 text-white/70'"
                >
                  {{ isMember(org.id) ? 'Member' : 'Discover' }}
                </span>
              </div>
              <p class="font-mono text-sm text-white/70">
                {{ org.slug }}
              </p>
              <p class="text-xs uppercase tracking-wide text-white/50">
                Created {{ formatDate(org.created_at) }}
              </p>
              <p v-if="membershipForOrg(org.id)" class="text-xs text-emerald-200">
                You are a {{ membershipForOrg(org.id)?.org_role }}
              </p>
            </RouterLink>
            <div class="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
              <span class="text-sm text-white/70">Explore club</span>
              <template v-if="!isMember(org.id)">
                <button
                  type="button"
                  class="rounded px-3 py-1 text-xs font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60"
                  :class="joinButtonTone(org.id)"
                  :disabled="joinButtonDisabled(org.id)"
                  @click.stop="handleJoinRequest(org)"
                >
                  {{ joinButtonText(org.id) }}
                </button>
              </template>
              <span v-else class="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                Member
              </span>
            </div>
          </article>
        </div>
      </div>
    </div>

    <teleport to="body">
      <transition name="create-org-request-modal">
        <div
          v-if="showCreateModal"
          class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Request new organization"
          @click.self="closeCreateModal"
        >
          <form class="w-full max-w-xl overflow-hidden rounded-lg border border-white/10 bg-[#0f1016] text-white shadow-2xl" @submit.prevent="handleCreateRequest">
            <header class="border-b border-white/10 px-6 py-4">
              <p class="text-xs uppercase tracking-wide text-white/50">Request new organization</p>
              <h2 class="text-xl font-semibold">Tell us about your club</h2>
            </header>
            <div class="space-y-4 px-6 py-5">
              <div class="space-y-1">
                <label class="text-xs font-semibold uppercase tracking-wide text-white/60" for="request-org-name">
                  Organization name
                </label>
                <input
                  id="request-org-name"
                  v-model="createOrgName"
                  type="text"
                  autocomplete="off"
                  placeholder="Rugby Club"
                  class="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-semibold uppercase tracking-wide text-white/60" for="request-org-slug">
                  Preferred slug
                </label>
                <input
                  id="request-org-slug"
                  v-model="createOrgSlug"
                  type="text"
                  autocomplete="off"
                  placeholder="rugby-club"
                  class="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                  @input="slugManuallyEdited = true"
                />
                <p class="text-xs text-white/50">Used in URLs. We’ll keep it lowercase with dashes.</p>
              </div>
              <div class="space-y-1">
                <label class="text-xs font-semibold uppercase tracking-wide text-white/60" for="request-org-notes">
                  Notes (optional)
                </label>
                <textarea
                  id="request-org-notes"
                  v-model="createOrgNotes"
                  rows="4"
                  class="w-full rounded border border-white/20 bg-black/40 p-3 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                  placeholder="Share any context—league, level, links, etc."
                />
              </div>
              <p v-if="createRequestError" class="text-sm text-rose-300">
                {{ createRequestError }}
              </p>
            </div>
            <div class="flex justify-end gap-3 border-t border-white/10 bg-black/40 px-6 py-4">
              <button
                type="button"
                class="rounded border border-white/30 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
                :disabled="createRequestLoading"
                @click="closeCreateModal"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="rounded border border-blue-500 bg-blue-600 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!canSubmitCreate"
              >
                <span v-if="createRequestLoading">Sending…</span>
                <span v-else>Submit request</span>
              </button>
            </div>
          </form>
        </div>
      </transition>
    </teleport>
  </section>
</template>

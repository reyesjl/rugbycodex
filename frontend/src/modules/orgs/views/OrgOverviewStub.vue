<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useOrgCapabilities } from '@/modules/orgs/composables/useOrgCapabilities';
import { useActiveOrgStore } from '@/modules/orgs/stores/useActiveOrgStore';
import { profileService } from '@/modules/profiles/services/ProfileService';
import { orgService } from '@/modules/orgs/services/orgService';
import type { MembershipRole, UserProfile } from '@/modules/profiles/types';

const activeOrgStore = useActiveOrgStore();
const { activeOrg, activeMembership, loading, error } = storeToRefs(activeOrgStore);

const authStore = useAuthStore();
const { isAdmin } = storeToRefs(authStore);

const ownerProfile = ref<UserProfile | null>(null);
let ownerRequestId = 0;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const org = computed(() => activeOrg.value);
const membershipRole = computed(() => activeMembership.value?.org_role ?? null);

const { hasAccess } = useOrgCapabilities(membershipRole, isAdmin);

const formatDate = (date: Date | null | undefined, options?: Intl.DateTimeFormatOptions) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat(undefined, options ?? { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
};

const formattedCreatedAt = computed(() => formatDate(org.value?.created_at));


const ownerHandle = computed(() =>
  ownerProfile.value?.username ? `@${ownerProfile.value.username}` : null
);
const ownerDisplayName = computed(() => {
  if (ownerHandle.value) return ownerHandle.value;
  if (ownerProfile.value?.name) return ownerProfile.value.name;
  return 'Not assigned';
});
const ownerProfileLink = computed(() => {
  if (ownerProfile.value?.username) {
    return `/v2/profile/${ownerProfile.value.username}`;
  }
  return null;
});

const quickLinks = computed(() => {
  if (!org.value) return [];
  const base = `/v2/orgs/${org.value.slug}`;
  const entries: Array<{ label: string; description: string; icon: string; to: string; minRole?: MembershipRole }> = [
    {
      label: 'Vaults',
      description: 'Access shared documents and data rooms.',
      icon: 'carbon:data-enrichment',
      to: `${base}/vaults`,
      minRole: 'member',
    },
    {
      label: 'Media',
      description: 'Review uploaded film, clips, and assets.',
      icon: 'carbon:image',
      to: `${base}/media`,
      minRole: 'member',
    },
    {
      label: 'Narrations',
      description: 'Listen to callouts and tactical briefs.',
      icon: 'carbon:microphone',
      to: `${base}/narrations`,
      minRole: 'member',
    },
    {
      label: 'Members',
      description: 'See everyone in this workspace.',
      icon: 'carbon:user-multiple',
      to: `${base}/members`,
      minRole: 'staff',
    },
    {
      label: 'Settings',
      description: 'Update branding, storage, and permissions.',
      icon: 'carbon:settings',
      to: `${base}/settings`,
      minRole: 'manager',
    },
  ];
  return entries.filter((entry) => hasAccess(entry.minRole));
});

const stubStats = reactive({
  members: '—',
  media: '—',
  narrations: '—',
});

const formatMediaMinutes = (totalSeconds: number) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '0';
  }
  const minutes = totalSeconds / 60;
  if (minutes < 1) {
    return '< 1';
  }
  return new Intl.NumberFormat().format(Math.round(minutes));
};

let mediaMinutesRequestId = 0;
let memberCountRequestId = 0;

const loadMediaMinutes = async (orgId: string) => {
  mediaMinutesRequestId += 1;
  const requestId = mediaMinutesRequestId;
  try {
    const totalSeconds = await orgService.mediaAssets.getTotalDurationSeconds(orgId);
    if (requestId === mediaMinutesRequestId) {
      stubStats.media = formatMediaMinutes(totalSeconds);
    }
  } catch (err) {
    console.error(err);
    if (requestId === mediaMinutesRequestId) {
      stubStats.media = '—';
    }
  }
};

const formatMemberCount = (count: number) => {
  if (!Number.isFinite(count) || count < 0) {
    return '—';
  }
  return new Intl.NumberFormat().format(count);
};

const loadMemberCount = async (orgId: string) => {
  memberCountRequestId += 1;
  const requestId = memberCountRequestId;
  try {
    const members = await profileService.memberships.listByOrganization(orgId);
    if (requestId === memberCountRequestId) {
      stubStats.members = formatMemberCount(members.length);
    }
  } catch (err) {
    console.error(err);
    if (requestId === memberCountRequestId) {
      stubStats.members = '—';
    }
  }
};

watch(
  () => org.value?.id ?? null,
  (orgId) => {
    if (!orgId) {
      mediaMinutesRequestId += 1;
      memberCountRequestId += 1;
      stubStats.media = '—';
      stubStats.members = '—';
      return;
    }
    stubStats.media = '—';
    stubStats.members = '—';
    loadMediaMinutes(orgId);
    loadMemberCount(orgId);
  },
  { immediate: true }
);

watch(
  () => org.value?.owner ?? null,
  async (ownerIdentifier) => {
    ownerRequestId += 1;
    const requestId = ownerRequestId;
    ownerProfile.value = null;
    if (!ownerIdentifier) {
      return;
    }
    try {
      const trimmed = ownerIdentifier.trim();
      if (!trimmed) return;
      const profile = UUID_PATTERN.test(trimmed)
        ? await profileService.profiles.getById(trimmed)
        : await profileService.profiles.getByUsername(trimmed);
      if (requestId === ownerRequestId) {
        ownerProfile.value = profile;
      }
    } catch (err) {
      if (requestId === ownerRequestId) {
        console.error(err);
      }
    }
  },
  { immediate: true }
);
</script>

<template>
  <section class="container space-y-8 py-6 text-white">
    <div v-if="loading" class="rounded border border-white/15 bg-black/40 p-6 text-white/70">
      Loading organization…
    </div>

    <div v-else-if="error" class="rounded border border-rose-400/40 bg-rose-500/10 p-6 text-white">
      <p class="font-semibold">{{ error }}</p>
      <p class="mt-2 text-sm text-white/80">Double-check the organization link or go back to the directory.</p>
      <RouterLink
        to="/v2/organizations"
        class="mt-4 inline-flex items-center rounded border border-white/30 px-4 py-2 text-sm font-semibold uppercase tracking-wide hover:bg-white/10"
      >
        Return to organizations
      </RouterLink>
    </div>

    <div v-else-if="org" class="space-y-8">
      <header class="rounded border border-white/15 bg-white/5 p-6 text-white">
        <div class="flex justify-between text-xs">
          <span>Founded {{ formattedCreatedAt }}</span>
          <template v-if="ownerProfileLink">
            <div class="flex gap-1">
              <div>Owner </div>
              <RouterLink
              :to="ownerProfileLink"
              class="font-semibold text-white underline-offset-4 hover:underline"
            >
              {{ ownerDisplayName }}
            </RouterLink>
            </div>
          </template>
          <span v-else>Owner {{ ownerDisplayName }}</span>
        </div>
        <div class="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 class="text-4xl font-semibold">{{ org.name }}</h1>
              <p class="text-xs w-full md:w-3/4 mt-4 whitespace-pre-line text-white/80">
                {{ org.bio ?? 'No bio yet. Add one from the organization settings to help members understand the mission and goals.' }}
              </p>
          </div>
        </div>
      </header>

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article class="rounded border border-white/15 bg-black/40 p-4">
          <p class="text-xs uppercase tracking-wide text-white/50">Members</p>
          <div class="mt-2 text-4xl font-semibold">
            {{ stubStats.members }}
          </div>
          <p class="mt-1 text-sm text-white/60">People with roles inside this workspace.</p>
        </article>

        <article class="rounded border border-white/15 bg-black/40 p-4">
          <p class="text-xs uppercase tracking-wide text-white/50">Media minutes</p>
          <div class="mt-2 text-4xl font-semibold">
            {{ stubStats.media }}
          </div>
          <p class="mt-1 text-sm text-white/60">Total minutes of film uploaded.</p>
        </article>

        <article class="rounded border border-white/15 bg-black/40 p-4">
          <p class="text-xs uppercase tracking-wide text-white/50">Narrations</p>
          <div class="mt-2 text-4xl font-semibold">
            {{ stubStats.narrations }}
          </div>
          <p class="mt-1 text-sm text-white/60">Clips narrated by members of this org.</p>
        </article>
      </section>

      <section class="rounded border border-white/15 bg-white/5 p-6">
        <header class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-2xl font-semibold">Workspace quick links</h2>
            <p class="text-sm text-white/60">Jump straight into the most visited areas of this org.</p>
          </div>
          <RouterLink
            to="/v2/organizations"
            class="inline-flex items-center rounded border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-white/10"
          >
            Browse directory
          </RouterLink>
        </header>
        <div v-if="quickLinks.length" class="mt-5 grid gap-4 md:grid-cols-2">
          <RouterLink
            v-for="link in quickLinks"
            :key="link.to"
            :to="link.to"
            class="flex items-start gap-4 rounded border border-white/15 bg-black/30 p-4 transition hover:border-white/40 hover:bg-white/10"
          >
            <Icon :icon="link.icon" class="h-6 w-6 text-white/70" />
            <div>
              <p class="text-lg font-semibold">{{ link.label }}</p>
              <p class="text-sm text-white/60">{{ link.description }}</p>
            </div>
          </RouterLink>
        </div>
        <p v-else class="mt-5 rounded border border-white/15 bg-black/30 p-4 text-sm text-white/70">
          Join this organization to unlock workspace links and tools.
        </p>
      </section>
    </div>
  </section>
</template>

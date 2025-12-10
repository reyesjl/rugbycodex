<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { OrgMembership } from '@/modules/profiles/types';

type OrgLinks = {
  overview: string;
  media: string;
  members: string;
  settings: string;
};

const props = defineProps<{
  profileName: string;
  membership: OrgMembership | null;
  orgLinks: OrgLinks | null;
  membershipCount: number;
}>();

const hasOrg = computed(() => Boolean(props.membership && props.orgLinks));
const orgName = computed(() => props.membership?.org_name ?? 'Your organization');
const roleLabel = computed(() => props.membership?.org_role ?? 'owner');

const quickLinks = computed(() => {
  if (!props.orgLinks) {
    return [] as Array<{ label: string; description: string; icon: string; to: string }>;
  }
  return [
    { label: 'Overview', description: 'Pulse, trends, and sessions', icon: 'carbon:dashboard', to: props.orgLinks.overview },
    { label: 'Media', description: 'Uploads, storage, and tags', icon: 'carbon:image-multiple', to: props.orgLinks.media },
    { label: 'Members', description: 'Invite coaches + staff', icon: 'carbon:user-multiple', to: props.orgLinks.members },
    { label: 'Settings', description: 'Branding, permissions, billing', icon: 'carbon:settings', to: props.orgLinks.settings },
  ];
});
</script>

<template>
  <section class="space-y-8">
    <div class="rounded border border-emerald-500/30 bg-emerald-500/10 p-6 text-white">
      <p class="text-xs uppercase tracking-wide text-emerald-200/70">Org leadership</p>
      <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-2xl font-semibold">{{ orgName }}</p>
          <p class="text-white/70">{{ roleLabel }} · {{ membershipCount }} orgs in your workspace</p>
        </div>
        <RouterLink
          v-if="hasOrg"
          class="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 px-4 py-2 text-sm font-semibold uppercase tracking-wide hover:bg-emerald-400/10"
          :to="orgLinks?.overview ?? '/v2/organizations'"
        >
          Enter org
          <Icon icon="carbon:arrow-right" width="18" height="18" />
        </RouterLink>
      </div>
    </div>

    <div class="rounded border border-white/10 bg-white/5">
      <header class="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
        <div>
          <p class="text-xs uppercase tracking-wide text-white/40">Quick actions</p>
          <p class="text-lg font-semibold">Keep your staff moving</p>
        </div>
      </header>
      <div class="grid gap-4 p-4 md:grid-cols-2">
        <RouterLink
          v-for="link in quickLinks"
          :key="link.label"
          :to="link.to"
          class="flex items-center gap-3 rounded border border-white/10 bg-black/30 p-4 text-white hover:border-white/40"
        >
          <div class="rounded-full border border-white/20 p-2">
            <Icon :icon="link.icon" width="22" height="22" />
          </div>
          <div>
            <p class="font-semibold">{{ link.label }}</p>
            <p class="text-sm text-white/70">{{ link.description }}</p>
          </div>
        </RouterLink>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <article class="rounded border border-white/10 bg-black/30 p-4 text-white">
        <p class="text-sm font-semibold text-white/80">On-deck items</p>
        <ul class="mt-4 space-y-3 text-sm text-white/70">
          <li>Assign analysts to the Exiles v Stormers vault.</li>
          <li>Add 2025 conditioning template to the shared folder.</li>
          <li>Review 6 pending member invites.</li>
        </ul>
      </article>
      <article class="rounded border border-white/10 bg-black/30 p-4 text-white">
        <p class="text-sm font-semibold text-white/80">Signals</p>
        <ul class="mt-4 space-y-3 text-sm text-white/70">
          <li>Storage at 72% capacity — consider archiving raw streams.</li>
          <li>3 narrations awaiting approval.</li>
          <li>Tagging backlog down 18% week-over-week.</li>
        </ul>
      </article>
    </div>
  </section>
</template>

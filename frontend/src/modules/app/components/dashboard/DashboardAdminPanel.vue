<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { profileService } from '@/modules/profiles/services/ProfileService';
import { orgService } from '@/modules/orgs/services/orgService';

const props = defineProps<{ profileName: string; membershipCount: number }>();

const shortName = computed(() => props.profileName?.split(' ')[0] ?? 'there');

const orgCount = ref<number | null>(null);
const userCount = ref<number | null>(null);
const mediaSeconds = ref<number | null>(null);
const pulseError = ref<string | null>(null);
const pulseLoading = ref(false);

const orgCountDisplay = computed(() => orgCount.value ?? props.membershipCount ?? null);

const formatNumber = (value: number | null) => {
  if (value == null) return '—';
  return new Intl.NumberFormat().format(value);
};

const formatMediaMinutes = (totalSeconds: number | null) => {
  if (!Number.isFinite(totalSeconds ?? NaN) || (totalSeconds ?? 0) <= 0) return '—';
  const minutes = (totalSeconds ?? 0) / 60;
  if (minutes < 1) return '< 1';
  return new Intl.NumberFormat().format(Math.round(minutes));
};

const loadPulse = async () => {
  pulseLoading.value = true;
  pulseError.value = null;
  try {
    const [orgs, users, mediaTotalSeconds] = await Promise.all([
      orgService.organizations.countAll(),
      profileService.profiles.countAll(),
      orgService.mediaAssets.getTotalDurationSecondsAll().catch(() => null),
    ]);

    orgCount.value = orgs ?? 0;
    userCount.value = users ?? 0;
    mediaSeconds.value = mediaTotalSeconds;
  } catch (err) {
    pulseError.value = err instanceof Error ? err.message : 'Unable to load platform stats.';
  } finally {
    pulseLoading.value = false;
  }
};

onMounted(() => {
  void loadPulse();
});

const adminLinks = [
  {
    label: 'Organizations',
    description: 'Approve new clubs, audit metadata, and monitor onboarding health.',
    icon: 'carbon:group-presentation',
    to: '/v2/admin/orgs',
  },
  {
    label: 'Users',
    description: 'View recently active analysts, suspend access, or reset MFA.',
    icon: 'carbon:user-multiple',
    to: '/v2/admin/users',
  },
  {
    label: 'Narrations',
    description: 'Moderate queue submissions before we surface them to org libraries.',
    icon: 'carbon:microphone',
    to: '/v2/admin/narrations',
  },
  {
    label: 'Media Review',
    description: 'Run spot checks on new uploads and enforce federation policy.',
    icon: 'carbon:image-search',
    to: '/v2/admin/media',
  },
];
</script>

<template>
  <section class="space-y-8">
    <div class="rounded border border-white/15 bg-white/5 p-6 text-white">
      <p class="text-sm uppercase tracking-wide text-white/60">Platform pulse</p>
      <div class="mt-3 text-xs text-rose-200" v-if="pulseError">
        {{ pulseError }}
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article class="rounded border border-white/10 bg-black/30 p-4">
          <p class="text-xs uppercase tracking-wide text-white/40">Organizations</p>
          <div class="mt-2 text-3xl font-semibold">
            {{ formatNumber(orgCountDisplay) }}
            <span v-if="pulseLoading" class="ml-2 align-middle text-sm text-white/60">…</span>
          </div>
        </article>
        <article class="rounded border border-white/10 bg-black/30 p-4">
          <p class="text-xs uppercase tracking-wide text-white/40">Users</p>
          <div class="mt-2 text-3xl font-semibold">
            {{ formatNumber(userCount) }}
            <span v-if="pulseLoading" class="ml-2 align-middle text-sm text-white/60">…</span>
          </div>
        </article>
        <article class="rounded border border-white/10 bg-black/30 p-4">
          <p class="text-xs uppercase tracking-wide text-white/40">mins uploaded</p>
          <div class="mt-2 text-3xl font-semibold">
            {{ formatMediaMinutes(mediaSeconds) }}
            <span v-if="pulseLoading" class="ml-2 align-middle text-sm text-white/60">…</span>
          </div>
        </article>
        <article class="rounded border border-white/10 bg-black/30 p-4">
          <p class="text-xs uppercase tracking-wide text-white/40">Narrations</p>
          <div class="mt-2 text-3xl font-semibold">
            —
            <span v-if="pulseLoading" class="ml-2 align-middle text-sm text-white/60">…</span>
          </div>
        </article>
      </div>
    </div>

    <div class="rounded border border-white/15 bg-white/5">
      <header class="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p class="text-xs uppercase tracking-wide text-white/40">Control room</p>
          <p class="text-lg font-semibold text-white">Where to next, {{ shortName }}?</p>
        </div>
      </header>
      <ul>
        <li
          v-for="link in adminLinks"
          :key="link.label"
          class="border-b border-white/10 last:border-b-0"
        >
          <RouterLink
            class="flex items-start gap-4 px-4 py-4 hover:bg-white/10"
            :to="link.to"
          >
            <div class="rounded-full border border-white/20 p-2">
              <Icon :icon="link.icon" width="20" height="20" class="text-white" />
            </div>
            <div class="text-white">
              <p class="font-medium">{{ link.label }}</p>
              <p class="text-sm text-white/70">{{ link.description }}</p>
            </div>
          </RouterLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { profileService } from '@/modules/profiles/services/ProfileService';
import { orgService } from '@/modules/orgs/services/orgService';
import CoachGuide from '@/modules/app/components/CoachGuide.vue';
import OrganizationsSection from './admin/OrganizationsSection.vue';
import OperationsSection from './admin/OperationsSection.vue';
import PeopleSection from './admin/PeopleSection.vue';

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
  <section class="space-y-20 text-white">
    <div class="header space-y-5">
      <div class="text-2xl">Platform status</div>
      <CoachGuide>
        <div class="space-y-1">
          <p class="text-lg font-semibold text-white/90">All system operational.</p>
          <p class="text-sm text-white/70">TMO looks good from all angles.</p>
        </div>
      </CoachGuide>
    </div>


    <OrganizationsSection />

    <OperationsSection />
    
    <PeopleSection />
      
  </section>
</template>

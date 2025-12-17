<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { profileService } from '@/modules/profiles/services/ProfileService';
import { orgService } from '@/modules/orgs/services/orgService';
import CoachGuide from '@/modules/app/components/CoachGuide.vue';
import OrganizationsSection from './admin/OrganizationsSection.vue';
import OperationsSection from './admin/OperationsSection.vue';
import PeopleSection from './admin/PeopleSection.vue';

defineProps<{ profileName: string; membershipCount: number }>();

const orgCount = ref<number | null>(null);
const userCount = ref<number | null>(null);
const mediaSeconds = ref<number | null>(null);
const pulseError = ref<string | null>(null);
const pulseLoading = ref(false);

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

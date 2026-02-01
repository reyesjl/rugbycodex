<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useActiveOrganizationStore } from '../stores/useActiveOrganizationStore';
import OrgStatsOverview from '@/modules/orgs/components/OrgStatsOverview.vue';

const activeOrganizationStore = useActiveOrganizationStore();
const { orgContext, resolving } = storeToRefs(activeOrganizationStore);

const org = computed(() => orgContext.value?.organization ?? null);

// Personalized greeting based on time of day
const greeting = computed(() => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }

  if (hour >= 12 && hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
});
</script>

<template>
  <div>
    <div v-if="resolving" class="container-lg py-6 text-white">
      <div class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
        Loading organization…
      </div>
    </div>

    <div v-else-if="!org" class="container-lg py-6 text-white">
      <div class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
        Organization unavailable.
      </div>
    </div>

    <div v-else>
      <!-- Header section with gradient -->
      <div class="bg-gradient-to-t from-black to-blue-900/40">
        <section class="container-lg space-y-6 py-10 text-white">
          <div class="text-4xl flex flex-col md:flex-row md:gap-1">
            <div>{{ greeting }},</div>
            <div class="text-white/70 tracking-wider">{{ org.name }}</div>
          </div>

          <!-- Stats Overview -->
          <OrgStatsOverview />
        </section>
      </div>

      <!-- Placeholder for future content -->
      <section class="container-lg py-6 pb-50 text-white">
        <div class="text-center text-white/40 py-20">
          Content coming soon...
        </div>
      </section>
    </div>
  </div>
</template>

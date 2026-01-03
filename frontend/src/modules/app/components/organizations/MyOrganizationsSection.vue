<script setup lang="ts">
import type { UserOrganizationSummary } from '@/modules/orgs/types/UserOrganizationSummary';
import OrganizationCard from '@/modules/app/components/organizations/OrganizationCard.vue';

defineProps<{
  organizations: UserOrganizationSummary[];
  loading: boolean;
  error: string | null;
}>();
</script>

<template>
  <section class="space-y-3 mb-20">
    <div v-if="loading" class="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
      Loading your organizations…
    </div>

    <div v-else-if="error" class="rounded-lg border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-white">
      <p class="font-semibold">Unable to load your organizations.</p>
      <p class="mt-1 text-white/80">{{ error }}</p>
    </div>

    <div
      v-else-if="organizations.length === 0"
      class="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70"
    >
      You’re not a member of any organizations yet.
    </div>

    <div v-else class="no-scrollbar flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory">
      <OrganizationCard
        v-for="item in organizations"
        :key="item.organization.id"
        :name="item.organization.name"
        :slug="item.organization.slug"
        :bio="item.organization.bio"
        :type="item.organization.type"
        :role="item.membership.role"
        variant="horizontal"
        prominent
      />
    </div>
  </section>
</template>

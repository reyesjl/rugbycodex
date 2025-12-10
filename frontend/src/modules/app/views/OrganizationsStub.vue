<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { useProfileStore } from '@/modules/profiles/stores/useProfileStore';
import type { OrgMembership } from '@/modules/profiles/types';

const profileStore = useProfileStore();
const { memberships, loadingProfile } = storeToRefs(profileStore);

const getOrganizationLink = (membership: OrgMembership) => {
  return membership.slug ? `/v2/orgs/${membership.slug}` : `/v2/orgs/${membership.org_id}`;
};
</script>

<template>
  <div class="container-lg py-5 text-white space-y-4">
    <h2 class="text-xl">Organizations</h2>
    <ul class="mt-8 divide-y divide-white/10 rounded border border-white/10">
      <li
        v-if="loadingProfile"
        class="py-3 px-4 text-white/60"
      >
        Loading organizations...
      </li>
      <li
        v-else-if="memberships.length === 0"
        class="py-3 px-4 text-white/60"
      >
        No organizations yet.
      </li>
      <template v-else>
        <li
          v-for="membership in memberships"
          :key="membership.org_id"
        >
          <RouterLink
            class="group flex items-center justify-between py-3 px-4 hover:bg-white hover:text-black"
            :to="getOrganizationLink(membership)"
          >
            <div>
              <div class="font-semibold">
                {{ membership.org_name }}
              </div>
              <div class="text-sm group-hover:text-black">
                {{ membership.org_role }}
              </div>
            </div>
            <span class="text-xs uppercase tracking-wide">View</span>
          </RouterLink>
        </li>
      </template>
    </ul>
  </div>
</template>

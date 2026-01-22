import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import type { OrgRole } from '@/modules/orgs/types';

export const ROLE_RANK = {
  viewer: 0,
  member: 1,
  staff: 2,
  manager: 3,
  owner: 4,
} as const;

type RankedRole = keyof typeof ROLE_RANK;

const getRoleRank = (role: OrgRole) => ROLE_RANK[role as RankedRole] ?? -1;

export const useMyRugbyOrchestrator = () => {
  const myOrgs = useMyOrganizationsStore();
  const authStore = useAuthStore();
  const { items, loaded, hasOrganizations } = storeToRefs(myOrgs);
  const { isAuthenticated } = storeToRefs(authStore);

  const memberships = computed(() =>
    items.value.map((item) => ({
      orgId: item.membership.org_id,
      role: item.membership.role,
    }))
  );

  const highestRole = computed<OrgRole | null>(() => {
    let highest: OrgRole | null = null;
    let highestRank = -1;

    for (const membership of memberships.value) {
      const rank = getRoleRank(membership.role);
      if (rank > highestRank) {
        highestRank = rank;
        highest = membership.role;
      }
    }

    return highest;
  });

  const isCoachLike = computed(() => {
    if (!highestRole.value) return false;
    return getRoleRank(highestRole.value) >= ROLE_RANK.staff;
  });

  const isPlayerLike = computed(() =>
    memberships.value.some((membership) => membership.role === 'member')
  );

  const mode = computed<'coach' | 'player'>(() =>
    isCoachLike.value ? 'coach' : 'player'
  );

  const isEmptyState = computed(() =>
    isAuthenticated.value && loaded.value && !hasOrganizations.value
  );

  return {
    memberships,
    highestRole,
    isCoachLike,
    isPlayerLike,
    mode,
    hasOrganizations,
    isEmptyState,
  };
};

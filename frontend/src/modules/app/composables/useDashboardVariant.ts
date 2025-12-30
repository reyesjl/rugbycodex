import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useProfileStore } from '@/modules/profiles/stores/useProfileStore';
import { ROLE_ORDER, type OrgMembership } from '@/modules/profiles/types';

export type DashboardVariant = 'admin' | 'orgLeader' | 'orgContributor' | 'entry';

function sortMembershipsByRank(memberships: OrgMembership[]): OrgMembership[] {
  return [...memberships].sort((a, b) => {
    const aRank = ROLE_ORDER[a.org_role] ?? Number.MAX_SAFE_INTEGER;
    const bRank = ROLE_ORDER[b.org_role] ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
}

export function useDashboardVariant() {
  const authStore = useAuthStore();
  const profileStore = useProfileStore();

  const { isAdmin } = storeToRefs(authStore);
  const { profile, memberships } = storeToRefs(profileStore);

  const primaryMembership = computed<OrgMembership | null>(() => {
    if (!memberships.value.length) {
      return null;
    }

    // Prefer the user's explicitly set primary_org if it exists
    const primaryOrgId = profile.value?.primary_org;
    if (primaryOrgId) {
      const fallbackOrg = memberships.value.find(m => m.org_id === primaryOrgId);
      if (fallbackOrg) {
        return fallbackOrg;
      }
    }

    // Fallback to highest role if no primary_org is set or found
    return sortMembershipsByRank(memberships.value)[0] ?? null;
  });

  const variant = computed<DashboardVariant>(() => {
    if (isAdmin.value) {
      return 'admin';
    }

    if (!primaryMembership.value) {
      return 'entry';
    }

    const elevatedRoles: OrgMembership['org_role'][] = ['owner', 'manager'];
    if (elevatedRoles.includes(primaryMembership.value.org_role)) {
      return 'orgLeader';
    }

    return 'orgContributor';
  });

  const membershipCount = computed(() => memberships.value.length);

  return {
    variant,
    primaryMembership,
    membershipCount,
  };
}

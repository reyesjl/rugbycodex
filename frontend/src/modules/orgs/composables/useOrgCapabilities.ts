import { computed, type ComputedRef, type Ref } from 'vue';
import { ROLE_ORDER, type MembershipRole } from '@/modules/profiles/types';
import type { OrgCapabilities } from '@/modules/orgs/types/OrgCapabilities';

const roleRank = (role: MembershipRole | null | undefined) => {
  if (!role) return Number.POSITIVE_INFINITY;
  return ROLE_ORDER[role] ?? Number.POSITIVE_INFINITY;
};

export function hasOrgAccess(role: MembershipRole | null | undefined, minRole?: MembershipRole): boolean {
  if (!minRole) return true;
  return roleRank(role) <= roleRank(minRole);
}

export function computeOrgCapabilities(role: MembershipRole | null, isAdmin: boolean): OrgCapabilities {
  if (isAdmin) {
    return {
      canManageOrg: true,
      canManageMembers: true,
      canUploadMedia: true,
      canNarrate: true,
      canReviewAllNarrations: true,
      canDeleteNarrations: true,
    };
  }

  return {
    canManageOrg: hasOrgAccess(role, 'manager'),
    canManageMembers: hasOrgAccess(role, 'staff'),
    canUploadMedia: hasOrgAccess(role, 'member'),
    canNarrate: hasOrgAccess(role, 'member'),
    canReviewAllNarrations: hasOrgAccess(role, 'staff'),
    canDeleteNarrations: hasOrgAccess(role, 'manager'),
  };
}

export function useOrgCapabilities(
  role: Ref<MembershipRole | null> | ComputedRef<MembershipRole | null>,
  isAdmin: Ref<boolean> | ComputedRef<boolean>,
) {
  const capabilities = computed(() => computeOrgCapabilities(role.value, isAdmin.value));

  const hasAccess = (minRole?: MembershipRole) => {
    if (isAdmin.value) return true;
    return hasOrgAccess(role.value, minRole);
  };

  return {
    capabilities,
    hasAccess,
  };
}

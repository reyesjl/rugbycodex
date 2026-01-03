import { computed, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/auth/stores/useAuthStore'
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore'
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore'

export type DashboardVariant =
  | 'booting'
  | 'admin'
  | 'onboarding'
  | 'orgLeader'
  | 'orgContributor'

export function useDashboardState() {
  const authStore = useAuthStore()
  const { isAdmin, isAuthenticated } = storeToRefs(authStore)

  const myOrgs = useMyOrganizationsStore()
  const { hasOrganizations, loaded } = storeToRefs(myOrgs)

  const activeOrgStore = useActiveOrganizationStore()
  const { active } = storeToRefs(activeOrgStore)

  watchEffect(() => {
    if (!isAuthenticated.value) return
    void myOrgs.load()
  })

  const primaryRole = computed(() =>
    active.value?.membership.role ?? null
  )

  const variant = computed<DashboardVariant>(() => {
    if (!loaded.value) return 'booting'
    if (isAdmin.value) return 'admin'
    if (!hasOrganizations.value) return 'onboarding'

    if (
      primaryRole.value === 'owner' ||
      primaryRole.value === 'manager' ||
      primaryRole.value === 'staff'
    ) {
      return 'orgLeader'
    }

    return 'orgContributor'
  })

  return {
    variant,
    orgCount: myOrgs.membershipCount,
  }
}

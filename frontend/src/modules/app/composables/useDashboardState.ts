import { computed, watch, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/useAuthStore'
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore'
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore'

export type DashboardVariant =
  | 'booting'
  | 'admin'
  | 'onboarding'
  | 'orgLeader'
  | 'orgContributor'

export function useDashboardState() {
  const router = useRouter()
  const authStore = useAuthStore()
  const { isAdmin, isAuthenticated } = storeToRefs(authStore)

  const myOrgs = useMyOrganizationsStore()
  const { hasOrganizations, loaded } = storeToRefs(myOrgs)

  const activeOrgStore = useActiveOrganizationStore()
  const { orgContext } = storeToRefs(activeOrgStore)

  // Load my organizations when authenticated
  watch(
    isAuthenticated,
    (authed) => {
      if (!authed) return
      void myOrgs.load()
    },
    { immediate: true }
  )

  // Redirect to the correct dashboard variant
  watchEffect(() => {
    if (!loaded.value) return
    if (!hasOrganizations.value) return
    if (isAdmin.value) return

    void router.replace({ name: 'Organizations' })
  })

  const primaryRole = computed(() =>
    orgContext.value?.membership.role ?? null
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

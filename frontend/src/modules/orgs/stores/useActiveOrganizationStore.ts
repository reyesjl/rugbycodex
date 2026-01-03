import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserOrganizationSummary } from '@/modules/orgs/types'
import { orgService } from '@/modules/orgs/services/orgServiceV2'

export const useActiveOrganizationStore = defineStore('activeOrganization', () => {
  const active = ref<UserOrganizationSummary | null>(null)
  const resolving = ref(false)
  const error = ref<string | null>(null)

  const hasActiveOrg = computed(() => !!active.value)

  async function setActiveBySlug(slug: string) {
    resolving.value = true
    error.value = null

    try {
      active.value = await orgService.getOrgBySlugForUser(slug)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to resolve organization.'
      active.value = null
    } finally {
      resolving.value = false
    }
  }

  function clear() {
    active.value = null
    error.value = null
    resolving.value = false
  }

  return {
    active,
    hasActiveOrg,
    resolving,
    error,
    setActiveBySlug,
    clear,
  }
})

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserOrganizationSummary } from '@/modules/orgs/types'
import { orgService } from '@/modules/orgs/services/orgServiceV2'

export const useActiveOrganizationStore = defineStore('activeOrganization', () => {
  const orgContext = ref<UserOrganizationSummary | null>(null)

  const signals = {
    memberCount: ref<number | null>(null),
  }

  const status = {
    resolving: ref(false),
    error: ref<string | null>(null),
  }

  const resolveToken = ref(0)

  const hasActiveOrg = computed(() => !!orgContext.value)

  const memberCount = computed(() => signals.memberCount.value ?? 0)
  const resolving = computed(() => status.resolving.value)
  const error = computed(() => status.error.value)

  async function setActiveBySlug(slug: string) {
    const currentSlug = orgContext.value?.organization.slug
    if (currentSlug === slug) return

    const token = ++resolveToken.value

    status.resolving.value = true
    status.error.value = null
    signals.memberCount.value = null

    try {
      const nextOrg = await orgService.getOrgBySlugForUser(slug)
      if (token !== resolveToken.value) return

      orgContext.value = nextOrg

      const nextMemberCount = await orgService.getMemberCount(nextOrg.organization.id)
      if (token !== resolveToken.value) return

      signals.memberCount.value = nextMemberCount
    } catch (err) {
      if (token !== resolveToken.value) return

      status.error.value = err instanceof Error ? err.message : 'Unable to resolve organization.'
      orgContext.value = null
      signals.memberCount.value = null
    } finally {
      if (token === resolveToken.value) {
        status.resolving.value = false
      }
    }
  }

  function clear() {
    resolveToken.value++

    orgContext.value = null
    signals.memberCount.value = null
    status.error.value = null
    status.resolving.value = false
  }

  return {
    orgContext,
    hasActiveOrg,
    resolving,
    error,
    setActiveBySlug,
    clear,
    memberCount,
  }
});

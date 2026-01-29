import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { UserOrganizationSummary } from '@/modules/orgs/types'
import { orgService } from '@/modules/orgs/services/orgServiceV2'
import { useAuthStore } from '@/modules/auth/stores/useAuthStore'
import { setActiveOrgId } from './activeOrgContext'
import { setAxiomContext } from '@/lib/axiom'

export const useActiveOrganizationStore = defineStore('activeOrganization', () => {
  const authStore = useAuthStore()
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
  const isReady = computed(() => !!orgContext.value && !status.resolving.value)
  const orgContextReadonly = computed(() => orgContext.value)

  // Important: orgContext includes membership role and can become stale if the user
  // logs out and another user logs in (since Pinia stores persist in-memory).
  // Clear org context on auth identity changes so UI (e.g. Sidebar) updates immediately.
  watch(
    () => authStore.user?.id ?? null,
    (nextUserId, prevUserId) => {
      if (nextUserId !== prevUserId) {
        clear()
      }
    },
    { immediate: true },
  )

  async function setActiveBySlug(slug: string) {
    const currentSlug = orgContext.value?.organization.slug
    const currentMembershipUserId = (orgContext.value as any)?.membership?.user_id as string | null | undefined
    const authUserId = authStore.user?.id ?? null

    // If we already have this slug loaded *for the current user*, don't refetch.
    // But if the cached membership belongs to a different user (or is missing),
    // we must refresh to avoid showing stale role-gated UI.
    if (currentSlug === slug && currentMembershipUserId && authUserId && currentMembershipUserId === authUserId) return

    const token = ++resolveToken.value

    status.resolving.value = true
    status.error.value = null
    signals.memberCount.value = null

    try {
      const nextOrg = await orgService.getOrgBySlugForUser(slug)
      if (token !== resolveToken.value) return

      orgContext.value = nextOrg
      setActiveOrgId(nextOrg.organization.id ?? null)

      // Update Axiom context with org info
      setAxiomContext({
        org_id: nextOrg.organization.id,
        org_name: nextOrg.organization.name,
        org_slug: nextOrg.organization.slug,
        org_type: nextOrg.organization.type,
        org_role: (nextOrg as any)?.membership?.role || 'unknown',
      })

      const nextMemberCount = await orgService.getMemberCount(nextOrg.organization.id)
      if (token !== resolveToken.value) return

      signals.memberCount.value = nextMemberCount
    } catch (err) {
      if (token !== resolveToken.value) return

      status.error.value = err instanceof Error ? err.message : 'Unable to resolve organization.'
      orgContext.value = null
      signals.memberCount.value = null
      setActiveOrgId(null)

      // Clear org context from Axiom on error
      setAxiomContext({
        org_id: null,
        org_name: null,
        org_slug: null,
        org_type: null,
        org_role: null,
      })
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
    setActiveOrgId(null)

    // Clear org context from Axiom
    setAxiomContext({
      org_id: null,
      org_name: null,
      org_slug: null,
      org_type: null,
      org_role: null,
    })
  }

  function updateOrgBio(nextBio: string) {
    if (!orgContext.value) return
    const normalized = nextBio?.trim() || null
    orgContext.value.organization.bio = normalized
  }

  return {
    orgContext,
    hasActiveOrg,
    resolving,
    error,
    setActiveBySlug,
    clear,
    memberCount,
    isReady,
    orgContextReadonly,
    updateOrgBio,
  }
});

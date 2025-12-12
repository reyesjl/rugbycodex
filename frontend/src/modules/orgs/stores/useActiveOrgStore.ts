import { defineStore, storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useOrgCapabilities } from '@/modules/orgs/composables/useOrgCapabilities';
import { orgService } from '@/modules/orgs/services/orgService';
import type { OrgCapabilities, Organization } from '@/modules/orgs/types';
import type { OrgMembership } from '@/modules/profiles/types';
import { useProfileStore } from '@/modules/profiles/stores/useProfileStore';

export const useActiveOrgStore = defineStore('activeOrg', () => {
  const authStore = useAuthStore();
  const { isAdmin } = storeToRefs(authStore);

  const profileStore = useProfileStore();
  const { memberships } = storeToRefs(profileStore);

  const activeOrg = ref<Organization | null>(null);
  const activeMembership = ref<OrgMembership | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentSlug = ref<string | null>(null);

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const syncMembership = () => {
    if (!activeOrg.value) {
      activeMembership.value = null;
      return;
    }

    const match = memberships.value.find((membership: OrgMembership) => {
      return membership.slug === activeOrg.value?.slug || membership.org_id === activeOrg.value?.id;
    });

    activeMembership.value = match ?? null;
  };

  const loadBySlug = async (slug: string) => {
    loading.value = true;
    error.value = null;

    try {
      const org = UUID_PATTERN.test(slug)
        ? await orgService.organizations.getById(slug)
        : await orgService.organizations.getBySlug(slug);
      activeOrg.value = org;
      currentSlug.value = slug;
      syncMembership();
    } catch (err) {
      activeOrg.value = null;
      activeMembership.value = null;
      error.value = err instanceof Error ? err.message : 'Unable to load organization.';
    } finally {
      loading.value = false;
    }
  };

  const membershipRole = computed(() => activeMembership.value?.org_role ?? null);
  const { capabilities: computedCapabilities } = useOrgCapabilities(membershipRole, isAdmin);
  const capabilities = computed<OrgCapabilities>(() => computedCapabilities.value);

  const ensureLoaded = async (slug: string | null | undefined) => {
    if (!slug) {
      clear();
      return;
    }

    if (currentSlug.value === slug && activeOrg.value) {
      syncMembership();
      return;
    }

    await loadBySlug(slug);
  };

  const clear = () => {
    activeOrg.value = null;
    activeMembership.value = null;
    currentSlug.value = null;
    loading.value = false;
    error.value = null;
  };

  watch(memberships, () => {
    syncMembership();
  }, { immediate: true });

  return {
    activeOrg,
    activeMembership,
    capabilities,
    loading,
    error,
    ensureLoaded,
    loadBySlug,
    clear,
  };
});

import { ref } from 'vue';
import { type Organization } from '@/modules/orgs/types';
import { orgService } from '@/modules/orgs/services/orgService';


export function useOrganizationList() {
  const organizations = ref<Organization[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const loadOrganizations = async () => {
    loading.value = true;
    error.value = null;
    try {
      organizations.value = await orgService.organizations.list();
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load organizations.';
    } finally {
      loading.value = false;
    }
  };

  return {

    organizations,
    loading,
    error,

    loadOrganizations,
  }
};
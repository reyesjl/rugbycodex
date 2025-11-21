import { computed, ref } from 'vue';
import { type ProfileWithMembership } from '@/modules/profiles/types';
import { profileService } from '@/modules/profiles/services/ProfileService';


export function useOrgMembers() {
  const list = ref<ProfileWithMembership[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const loadMembers = async (org_id: string) => {
    loading.value = true;
    error.value = null;
    try {
      list.value = await profileService.memberships.listByOrganization(org_id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load org members.';
    } finally {
      loading.value = false;
    }
  };

  const memberCount = computed(() => {
    return list.value.length;
  });

  return {
    list,
    loading,
    error,
    memberCount,

    loadMembers,
  }
};



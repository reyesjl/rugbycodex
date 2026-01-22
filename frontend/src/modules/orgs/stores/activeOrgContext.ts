import { ref } from 'vue';

export const activeOrgIdRef = ref<string | null>(null);

export function setActiveOrgId(orgId: string | null) {
  activeOrgIdRef.value = orgId;
}

import { computed } from 'vue';
import { useProfileStore } from '../stores/useProfileStore';

export function useProfileDisplay() {
  const profileStore = useProfileStore();

  const displayName = computed(() => {
    const p = profileStore.profile;
    if (!p) return 'there';
    return p.name || p.username || 'there';
  });

  return {
    displayName,
  };
}

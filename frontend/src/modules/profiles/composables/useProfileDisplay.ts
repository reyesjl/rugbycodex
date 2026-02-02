import { computed } from 'vue';
import { useUserContextStore } from '@/modules/user/stores/useUserContextStore';

export function useProfileDisplay() {
  const userContextStore = useUserContextStore();

  const name = computed(() => userContextStore.profile?.name || '');
  const username = computed(() => userContextStore.profile?.username || '');

  const displayName = computed(() => {
    const p = userContextStore.profile;
    if (!p) return 'there';
    return p.name || p.username || 'there';
  });

  const initials = computed(() => {
    const fullName = name.value.trim();
    if (!fullName) return '?';
    const parts = fullName.split(/\s+/).filter(part => part.length > 0);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
    return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
  });

  return {
    name,
    username,
    displayName,
    initials,
  };
}

import { computed } from 'vue';
import { useProfileStore } from '../stores/useProfileStore';

export function useProfileDisplay() {
  const profileStore = useProfileStore();

  const name = computed(() => profileStore.profile?.name || '');
  const username = computed(() => profileStore.profile?.username || '');

  const displayName = computed(() => {
    const p = profileStore.profile;
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

import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useUserContextStore } from '@/modules/user/stores/useUserContextStore';
import type { OrgRole } from '@/modules/orgs/types';
import type { ViewContext } from '../types/ViewContext';

const STORAGE_KEY = 'rugbycodex:myRugby:viewContext';

const PLAYER_ROLES: OrgRole[] = ['member', 'viewer'];
const MANAGER_ROLES: OrgRole[] = ['owner', 'manager', 'staff'];

export const useMyRugbyViewContext = () => {
  const userContextStore = useUserContextStore();
  const { organizations: items, isReady: loaded } = storeToRefs(userContextStore);

  // Current view context
  const viewContext = ref<ViewContext>('player');

  // Determine which roles the user has across all orgs
  const hasPlayerRole = computed(() =>
    items.value.some((item) => PLAYER_ROLES.includes(item.membership.role))
  );

  const hasManagerRole = computed(() =>
    items.value.some((item) => MANAGER_ROLES.includes(item.membership.role))
  );

  // Can switch if user has both player and manager roles
  const canSwitchContext = computed(() => hasPlayerRole.value && hasManagerRole.value);

  // Filter organizations based on current context
  const contextFilteredOrgs = computed(() => {
    if (viewContext.value === 'manager') {
      return items.value.filter((item) => MANAGER_ROLES.includes(item.membership.role));
    }
    // Player view: only show orgs where user has player roles (member, viewer)
    return items.value.filter((item) => PLAYER_ROLES.includes(item.membership.role));
  });

  // Initialize view context based on user's roles
  const initializeViewContext = () => {
    if (!loaded.value) return;

    // If user has both roles, check localStorage
    if (canSwitchContext.value) {
      const stored = localStorage.getItem(STORAGE_KEY) as ViewContext | null;
      if (stored === 'player' || stored === 'manager') {
        viewContext.value = stored;
      } else {
        // Default to player if no preference
        viewContext.value = 'player';
      }
    }
    // If user only has manager roles, auto-select manager
    else if (hasManagerRole.value && !hasPlayerRole.value) {
      viewContext.value = 'manager';
    }
    // If user only has player roles, auto-select player
    else if (hasPlayerRole.value && !hasManagerRole.value) {
      viewContext.value = 'player';
    }
  };

  // Switch view context
  const setViewContext = (context: ViewContext) => {
    viewContext.value = context;
    localStorage.setItem(STORAGE_KEY, context);
  };

  // Watch for orgs to load and initialize context
  watch(
    loaded,
    (isLoaded) => {
      if (isLoaded) {
        initializeViewContext();
      }
    },
    { immediate: true }
  );

  return {
    viewContext,
    canSwitchContext,
    hasPlayerRole,
    hasManagerRole,
    contextFilteredOrgs,
    setViewContext,
  };
};

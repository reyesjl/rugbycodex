import { createRouter, createWebHistory } from 'vue-router';
import pinia from '@/lib/pinia';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { marketingRoutes } from './marketingRoutes';
import { authRoutes } from './authRoutes';
import { appRoutes } from './appRoutes';
import { orgRoutes } from './orgRoutes';
import { adminRoutes } from './adminRoutes';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { toast } from '@/lib/toast';


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, _from, savedPosition) {
    // If there's a saved position (browser back/forward button), use it
    if (savedPosition) {
      return savedPosition;
    }

    // If navigating to a hash (anchor link), scroll to it
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth'
      };
    }

    // Otherwise scroll to top
    return { top: 0, left: 0 }
  },
  routes: [
    marketingRoutes,
    appRoutes,
    adminRoutes,
    authRoutes,
    orgRoutes,
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia);
  const activeOrganizationStore = useActiveOrganizationStore(pinia);

  // hydrate first if not done yet
  if (!authStore.hydrated) {
    await authStore.initialize();
  }

  if (to.meta.orgScoped) {
    const orgSlug = to.params.slug as string;
    await activeOrganizationStore.setActiveBySlug(orgSlug);

    if (!activeOrganizationStore.orgContext) {
      toast({
          variant: "info",
          message:
              activeOrganizationStore.error ?? "Organization not found or access denied.",
          durationMs: 3000,
      });
      return {
        name: 'Organizations',
      };
    }
  }

  if ((to.meta.requiresAuth || to.meta.requiresAdmin) && !authStore.isAuthenticated) {
    return {
      name: 'Login',
      query: {
        redirect: to.fullPath !== '/' ? to.fullPath : undefined,
      },
    };
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return {
      name: 'Dashboard',
    };
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return {
      name: 'Dashboard',
    };
  }

  return true;
});

export default router;

import { createRouter, createWebHistory } from 'vue-router';
import pinia from '@/lib/pinia';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { marketingRoutes } from './marketingRoutes';
import { authRoutes } from './authRoutes';
import { appRoutes } from './appRoutes';
import { orgRoutes } from './orgRoutes';
import { adminRoutes } from './adminRoutes';

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
    adminRoutes,
    appRoutes,
    authRoutes,
    marketingRoutes,
    orgRoutes,
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia);

  // hydrate first if not done yet
  if (!authStore.hydrated) {
    await authStore.initialize();
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

import { createRouter, createWebHistory } from 'vue-router';
import pinia from '@/lib/pinia';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { v2Routes } from '@/router/v2-routes';

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
    ...v2Routes,
    {
      path: '/login',
      redirect: { name: 'V2Login' },
    },
    {
      path: '/signup',
      redirect: { name: 'V2Signup' },
    },
    {
      path: '/dashboard',
      redirect: { name: 'V2Dashboard' },
    },
    {
      path: '/organizations/:orgSlug',
      redirect: (to) => ({
        name: 'V2OrgOverview',
        params: { slug: String(to.params.orgSlug) },
      }),
    },
    {
      path: '/admin',
      redirect: { name: 'V2AdminOverview' },
    },
    {
      path: '/confirm-email',
      name: 'ConfirmEmail',
      component: () => import('@/auth/views/ConfirmEmail.vue'),
      meta: { layout: 'null' },
    },
    {
      path: '/reset-password',
      name: 'ResetPassword',
      component: () => import('@/auth/views/ResetPassword.vue'),
      meta: { layout: 'null', guestOnly: true },
    },
    {
      path: '/reset-password/update',
      name: 'ResetPasswordUpdate',
      component: () => import('@/auth/views/UpdatePassword.vue'),
      meta: { layout: 'null' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/views/404.vue'),
      meta: { layout: 'null' },
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia);

  if ((to.meta.requiresAuth || to.meta.requiresAdmin) && !authStore.isAuthenticated) {
    return {
      name: 'V2Login',
      query: {
        redirect: to.fullPath !== '/' ? to.fullPath : undefined,
      },
    };
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return {
      name: 'V2Dashboard',
    };
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return {
      name: 'V2Dashboard',
    };
  }

  return true;
});

export default router;

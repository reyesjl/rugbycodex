import { createRouter, createWebHistory } from 'vue-router';
import pinia from '@/stores';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { adminRoutes } from '@/router/admin';

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
    {
      path: '/',
      name: 'Overview',
      component: () => import('@/views/Overview.vue'),
    },
    {
      path: '/narrations',
      name: 'Narrations',
      component: () => import('@/views/Narrations.vue'),
    },
    {
      path: '/releases',
      name: 'Releases',
      component: () => import('@/views/Releases.vue'),
    },
    {
      path: '/inside',
      name: 'InsideTheCodex',
      component: () => import('@/views/Inside.vue'),
    },
    {
      path: '/codexui',
      name: 'CodexUI',
      component: () => import('@/views/CodexUI.vue'),
    },
    {
      path: '/inside/:slug',
      name: 'InsideArticle',
      component: () => import('@/views/InsideArticle.vue'),
    },
    {
      path: '/vaults',
      name: 'Vaults',
      component: () => import('@/views/Vaults.vue'),
    },
    {
      path: '/about',
      name: 'About',
      component: () => import('@/views/About.vue'),
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/auth/views/Login.vue'),
      meta: { layout: 'minimal', guestOnly: true },
    },
    {
      path: '/reset-password',
      name: 'ResetPassword',
      component: () => import('@/auth/views/ResetPassword.vue'),
      meta: { layout: 'minimal', guestOnly: true },
    },
    {
      path: '/reset-password/update',
      name: 'ResetPasswordUpdate',
      component: () => import('@/auth/views/UpdatePassword.vue'),
      meta: { layout: 'minimal' },
    },
    {
      path: '/signup',
      name: 'Signup',
      component: () => import('@/auth/views/Signup.vue'),
      meta: { layout: 'minimal', guestOnly: true },
    },
    {
      path: '/confirm-email',
      name: 'ConfirmEmail',
      component: () => import('@/auth/views/ConfirmEmail.vue'),
      meta: { layout: 'minimal' },
    },
    {
      path: '/dashboard',
      component: () => import('@/profiles/views/Dashboard.vue'),
      meta: { requiresAuth: true },
      name: 'Dashboard',
      children: [
        {
          path: '',
          name: 'DashboardOverview',
          component: () => import('@/profiles/views/dashboard/Overview.vue'),
        },
        {
          path: 'account',
          name: 'DashboardAccount',
          component: () => import('@/profiles/views/dashboard/Account.vue'),
        },
      ],
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/Settings.vue'),
      meta: { requiresAuth: true },
    },
    ...adminRoutes,
    {
      path: '/organizations/:orgSlug',
      name: 'OrganizationDetail',
      component: () => import('@/organizations/views/OrganizationDashboard.vue'),
      meta: { requiresAuth: true },
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'NotFound',
      component: () => import('@/views/404.vue'),
      meta: { layout: 'minimal' },
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia);

  const userDashboardRoutes = ['Dashboard', 'DashboardOverview', 'DashboardAccount'];

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
      name: 'DashboardOverview',
    };
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return {
      name: 'DashboardOverview',
    };
  }

  // Redirect admins away from the user dashboard routes
  if (
    authStore.isAuthenticated &&
    authStore.isAdmin &&
    typeof to.name === 'string' &&
    userDashboardRoutes.includes(to.name)
  ) {
    return { name: 'AdminOverview' };
  }

  return true;
});

export default router;

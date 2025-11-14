import { createRouter, createWebHistory } from 'vue-router';
import pinia from '@/stores';
import { useAuthStore } from '@/stores/auth';
import { useProfileStore } from '@/stores/profile';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { left: 0, top: 0 };
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
      component: () => import('@/views/auth/Login.vue'),
      meta: { layout: 'minimal', guestOnly: true },
    },
    {
      path: '/reset-password',
      name: 'ResetPassword',
      component: () => import('@/views/auth/ResetPassword.vue'),
      meta: { layout: 'minimal', guestOnly: true },
    },
    {
      path: '/reset-password/update',
      name: 'ResetPasswordUpdate',
      component: () => import('@/views/auth/UpdatePassword.vue'),
      meta: { layout: 'minimal' },
    },
    {
      path: '/signup',
      name: 'Signup',
      component: () => import('@/views/auth/Signup.vue'),
      meta: { layout: 'minimal', guestOnly: true },
    },
    {
      path: '/confirm-email',
      name: 'ConfirmEmail',
      component: () => import('@/views/auth/ConfirmEmail.vue'),
      meta: { layout: 'minimal' },
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('@/views/Dashboard.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/Settings.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin-dashboard',
      name: 'AdminDashboard',
      component: () => import('@/views/admin/AdminDashboard.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/organizations/:orgSlug',
      name: 'OrganizationDetail',
      component: () => import('@/views/organizations/OrganizationDashboard.vue'),
      meta: { requiresAuth: true },
      props: true,
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia);
  const profileStore = useProfileStore(pinia);

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

  // Verification for Admin Guard
  if (to.meta.requiresAdmin) {
    // Await profile load just in case, very likely that it is already
    // loaded
    const profileLoaded = await profileStore.waitForProfileLoad(500);
    if (!profileLoaded) {
      console.warn('[router] Profile not loaded yet, redirecting to Login.');
      return {
        name: 'Login',
        query: {
          redirect: to.fullPath !== '/' ? to.fullPath : undefined,
        },
      };
    }
    if (profileStore.isAdmin === false) {
      return {
        name: 'Dashboard',
      };
    }
  }

  return true;
});

export default router;

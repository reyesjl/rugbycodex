import { createRouter, createWebHistory } from 'vue-router';
import pinia from '@/stores';
import { useAuthStore } from '@/stores/auth';

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
      path: '/signup',
      name: 'Signup',
      component: () => import('@/views/auth/Signup.vue'),
      meta: { layout: 'minimal', guestOnly: true },
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('@/views/Dashboard.vue'),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore(pinia);

  if (!authStore.hydrated && !authStore.initializing) {
    await authStore.initialize();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
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

  return true;
});

export default router;

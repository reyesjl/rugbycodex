import { createRouter, createWebHistory } from 'vue-router';

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
  ],
});

export default router;

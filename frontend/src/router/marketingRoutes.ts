import type { RouteRecordRaw } from 'vue-router';

export const marketingRoutes: RouteRecordRaw = {
  path: '/',
  component: () => import('@/layouts/MarketingLayout.vue'),
  meta: { layout: 'marketing' },
  children: [
    {
      path: '',
      name: 'MarketingHome',
      component: () => import('@/modules/marketing/views/MarketingHome.vue'),
    },
    {
      path: 'players',
      name: 'ForPlayers',
      component: () => import('@/modules/marketing/views/ForPlayers.vue'),
    },
    {
      path: 'coaches',
      name: 'ForCoaches',
      component: () => import('@/modules/marketing/views/ForCoaches.vue'),
    },
    {
      path: 'unions',
      name: 'ForUnions',
      component: () => import('@/modules/marketing/views/ForUnions.vue'),
    },
    {
      path: 'mission',
      name: 'Mission',
      component: () => import('@/modules/marketing/views/Mission.vue'),
    },
    {
      path: 'acknowledgements',
      name: 'Acknowledgements',
      component: () => import('@/modules/marketing/views/Acknowledgements.vue'),
    },
  ],
};

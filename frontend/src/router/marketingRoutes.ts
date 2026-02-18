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
      path: 'features',
      name: 'Features',
      component: () => import('@/modules/marketing/views/Features.vue'),
    },
    {
      path: 'roles',
      name: 'MarketingRoles',
      component: () => import('@/modules/marketing/views/MarketingRoles.vue'),
    },
    {
      path: 'players',
      name: 'ForPlayers',
      redirect: (to) => ({
        name: 'MarketingRoles',
        query: { ...to.query, role: 'players' },
      }),
    },
    {
      path: 'coaches',
      name: 'ForCoaches',
      redirect: (to) => ({
        name: 'MarketingRoles',
        query: { ...to.query, role: 'coaches' },
      }),
    },
    {
      path: 'unions',
      name: 'ForUnions',
      redirect: (to) => ({
        name: 'MarketingRoles',
        query: { ...to.query, role: 'unions' },
      }),
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

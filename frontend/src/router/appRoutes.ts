import type { RouteRecordRaw } from 'vue-router';

export const appRoutes: RouteRecordRaw = {
  path: '/',
  component: () => import('@/layouts/AppLayout.vue'),
  meta: { layout: 'app', requiresAuth: true },
  children: [
    {
      path: 'my-rugby',
      name: 'MyRugby',
      component: () => import('@/modules/app/views/MyRugby.vue'),
    },
    {
      path: 'onboarding',
      name: 'Onboarding',
      component: () => import('@/modules/app/views/Onboarding.vue'),
    },
    {
      path: 'dashboard',
      name: 'Dashboard',
      component: () => import('@/modules/app/views/DashboardResolver.vue'),
    },
    {
      path: 'narrations',
      name: 'MyNarrations',
      component: () => import('@/modules/app/views/MyNarrationsStub.vue'),
    },
    {
      path: 'media',
      name: 'MyMedia',
      component: () => import('@/modules/app/views/MyMediaStub.vue'),
    },
    {
      path: 'organizations',
      name: 'Organizations',
      component: () => import('@/modules/app/views/Organizations.vue'),
    },
    {
      path: 'profile/:username?',
      name: 'Profile',
      component: () => import('@/modules/app/views/Profile.vue'),
      props: true,
    },
    {
      path: 'settings',
      name: 'Settings',
      component: () => import('@/modules/profiles/views/ProfileSettings.vue'),
    },
  ],
};


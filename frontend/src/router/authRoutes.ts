import type { RouteRecordRaw } from 'vue-router';

export const authRoutes: RouteRecordRaw = {
  path: '/v2/auth',
  component: () => import('@/layouts/AuthLayout.vue'),
  meta: { layout: 'auth', guestOnly: true },
  children: [
    {
      path: 'login',
      name: 'V2Login',
      component: () => import('@/modules/auth/views/Login.vue'),
    },
    {
      path: 'signup',
      name: 'V2Signup',
      component: () => import('@/modules/auth/views/Signup.vue'),
    }
  ],
};

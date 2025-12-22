import type { RouteRecordRaw } from 'vue-router';

export const authRoutes: RouteRecordRaw = {
  path: '/auth',
  component: () => import('@/layouts/AuthLayout.vue'),
  meta: { layout: 'auth', guestOnly: true },
  children: [
    {
      path: 'login',
      name: 'Login',
      component: () => import('@/modules/auth/views/Login.vue'),
    },
    {
      path: 'signup',
      name: 'Signup',
      component: () => import('@/modules/auth/views/Signup.vue'),
    }
  ],
};

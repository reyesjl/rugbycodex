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
      meta: { guestOnly: true },
    },
    {
      path: 'signup',
      name: 'Signup',
      component: () => import('@/modules/auth/views/Signup.vue'),
      meta: { guestOnly: true },
    },
    {
      path: 'forgot-password',
      name: 'ForgotPassword',
      component: () => import('@/modules/auth/views/ForgotPassword.vue'),
      meta: { guestOnly: true },
    },
    {
      path: 'reset-password',
      name: 'ResetPassword',
      component: () => import('@/modules/auth/views/ResetPassword.vue'),
      meta: { guestOnly: true },
    },
    {
      path: 'confirm-email',
      name: 'ConfirmEmail',
      component: () => import('@/modules/auth/views/ConfirmEmail.vue'),
      meta: { guestOnly: true },
    },
  ],
};

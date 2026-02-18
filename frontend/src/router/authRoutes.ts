import type { RouteRecordRaw } from 'vue-router';

export const authRoutes: RouteRecordRaw = {
  path: '/auth',
  component: () => import('@/layouts/AuthLayout.vue'),
  meta: { layout: 'auth' },
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
      path: 'waitlist',
      name: 'Waitlist',
      component: () => import('@/modules/auth/views/Waitlist.vue'),
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
    },
    {
      path: 'confirm-email',
      name: 'ConfirmEmail',
      component: () => import('@/modules/auth/views/ConfirmEmail.vue'),
    },
  ],
};

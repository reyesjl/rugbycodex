import type { RouteRecordRaw } from 'vue-router';

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    component: () => import('@/admin/views/AdminDashboard.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    name: 'AdminDashboard',
    children: [
      {
        path: '',
        name: 'AdminOverview',
        component: () => import('@/admin/views/AdminOverview.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'account',
        name: 'AdminAccount',
        component: () => import('@/views/Settings.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'organizations',
        name: 'AdminListOrgs',
        component: () => import('@/admin/views/AdminListOrgs.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'create-org',
        name: 'AdminCreateOrg',
        component: () => import('@/admin/views/AdminCreateOrg.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'profiles',
        name: 'AdminListProfiles',
        component: () => import('@/admin/views/AdminListProfiles.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'profiles/:id',
        name: 'AdminProfileDetail',
        component: () => import('@/admin/views/AdminProfileDetail.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'narrations',
        name: 'AdminNarrations',
        component: () => import('@/admin/views/AdminNarrationsPlaceholder.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
    ],
  },
];

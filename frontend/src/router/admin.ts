import type { RouteRecordRaw } from 'vue-router';

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminDashboard.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    name: 'AdminDashboard',
    children: [
      {
        path: '',
        name: 'AdminOverview',
        component: () => import('@/views/admin/AdminOverview.vue'),
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
        component: () => import('@/views/admin/AdminListOrgs.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'create-org',
        name: 'AdminCreateOrg',
        component: () => import('@/views/admin/AdminCreateOrg.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'profiles',
        name: 'AdminListProfiles',
        component: () => import('@/views/admin/AdminListProfiles.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'profiles/:id',
        name: 'AdminProfileDetail',
        component: () => import('@/views/admin/AdminProfileDetail.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'narrations',
        name: 'AdminNarrations',
        component: () => import('@/views/admin/AdminNarrationsPlaceholder.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
    ],
  },
];

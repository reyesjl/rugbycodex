import type { RouteRecordRaw } from 'vue-router';

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    component: () => import('@/modules/admin/views/v1/AdminDashboard.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
    name: 'AdminDashboard',
    children: [
      {
        path: '',
        name: 'AdminOverview',
        component: () => import('@/modules/admin/views/v1/AdminOverview.vue'),
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
        component: () => import('@/modules/admin/views/v1/AdminListOrgs.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'create-org',
        name: 'AdminCreateOrg',
        component: () => import('@/modules/admin/views/v1/AdminCreateOrg.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'profiles',
        name: 'AdminListProfiles',
        component: () => import('@/modules/admin/views/v1/AdminListProfiles.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'profiles/:id',
        name: 'AdminProfileDetail',
        component: () => import('@/modules/admin/views/v1/AdminProfileDetail.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
      {
        path: 'narrations',
        name: 'AdminNarrations',
        component: () => import('@/modules/admin/views/v1/AdminNarrationsPlaceholder.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, },
      },
    ],
  },
];

import type { RouteRecordRaw } from 'vue-router';

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin/organizations',
    name: 'AdminListOrgs',
    component: () => import('@/views/admin/AdminListOrgs.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/create-org',
    name: 'AdminCreateOrg',
    component: () => import('@/views/admin/AdminCreateOrg.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/profiles',
    name: 'AdminListProfiles',
    component: () => import('@/views/admin/AdminListProfiles.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/profiles/:id',
    name: 'AdminProfileDetail',
    component: () => import('@/views/admin/AdminProfileDetail.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
];

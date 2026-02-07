import type { RouteRecordRaw } from 'vue-router';

export const adminRoutes: RouteRecordRaw = {
  path: '/admin',
  component: () => import('@/layouts/AdminLayout.vue'),
  meta: { layout: 'admin', requiresAuth: true, requiresAdmin: true },
  children: [
    {
      path: '',
      name: 'AdminDashboard',
      component: () => import('@/modules/admin/views/AdminDashboardOverview.vue'),
    },
    {
      path: 'orgs',
      name: 'AdminOrgs',
      component: () => import('@/modules/admin/views/AdminOrgs.vue'),
    },
    {
      path: 'dashboard',
      redirect: { name: 'AdminDashboard' },
    },
    {
      path: 'org-requests',
      name: 'AdminOrgRequests',
      component: () => import('@/modules/admin/views/AdminOrgRequests.vue'),
    },
    {
      path: 'users',
      name: 'AdminUsers',
      component: () => import('@/modules/admin/views/AdminUsers.vue'),
    },
    {
      path: 'narrations',
      name: 'AdminNarrationsModeration',
      component: () => import('@/modules/admin/views/AdminNarrations.vue'),
    },
    {
      path: 'media',
      name: 'AdminMediaReview',
      component: () => import('@/modules/admin/views/AdminMediaReview.vue'),
    },
    {
      path: 'jobs',
      name: 'AdminJobs',
      component: () => import('@/modules/admin/views/AdminJobsStub.vue'),
    },
    {
      path: 'billing',
      name: 'AdminBilling',
      component: () => import('@/modules/admin/views/AdminBillingStub.vue'),
    },
  ],
};


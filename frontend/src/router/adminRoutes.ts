import type { RouteRecordRaw } from 'vue-router';

export const adminRoutes: RouteRecordRaw = {
  path: '/admin',
  component: () => import('@/layouts/AdminLayout.vue'),
  meta: { layout: 'admin', requiresAuth: true, requiresAdmin: true },
  children: [
    {
      path: '',
      name: 'AdminOrgs',
      component: () => import('@/modules/admin/views/AdminOrgs.vue'),
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
    {
      path: 'flags',
      name: 'AdminFeatureFlags',
      component: () => import('@/modules/admin/views/AdminFeatureFlagsStub.vue'),
    },
    {
      path: 'experiments',
      name: 'AdminExperiments',
      component: () => import('@/modules/admin/views/AdminExperimentsStub.vue'),
    },
  ],
};


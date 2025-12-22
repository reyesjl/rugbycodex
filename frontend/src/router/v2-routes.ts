import type { RouteRecordRaw } from 'vue-router';

export const v2Routes: RouteRecordRaw[] = [
  {
    path: '/orgs/:slug',
    component: () => import('@/layouts/OrgLayout.vue'),
    meta: { layout: 'org', requiresAuth: true },
    children: [
      {
        path: '',
        name: 'OrgHome',
        redirect: { name: 'OrgOverview' },
      },
      {
        path: 'overview',
        name: 'OrgOverview',
        component: () => import('@/modules/orgs/views/OrgOverviewStub.vue'),
        props: true,
      },
      {
        path: 'vaults',
        name: 'OrgVaults',
        component: () => import('@/modules/orgs/views/OrgVaultsStub.vue'),
        props: true,
      },
      {
        path: 'narrations',
        name: 'OrgNarrations',
        component: () => import('@/modules/orgs/views/OrgNarrationsStub.vue'),
        props: true,
      },
      {
        path: 'media',
        name: 'OrgMedia',
        component: () => import('@/modules/orgs/views/OrgMedia.vue'),
        props: true,
      },
      {
        path: 'media/:assetId',
        name: 'OrgMediaAsset',
        component: () => import('@/modules/orgs/views/OrgMediaAssetView.vue'),
        props: true,
      },
      {
        path: 'members',
        name: 'OrgMembers',
        component: () => import('@/modules/orgs/views/OrgMembersStub.vue'),
        props: true,
      },
      {
        path: 'settings',
        name: 'OrgSettings',
        component: () => import('@/modules/orgs/views/OrgSettingsStub.vue'),
        props: true,
      },
      {
        path: 'admin',
        name: 'OrgAdminTools',
        component: () => import('@/modules/orgs/views/OrgAdminToolsStub.vue'),
        props: true,
      },
    ],
  },
  {
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
        path: 'users',
        name: 'AdminUsers',
        component: () => import('@/modules/admin/views/AdminUsers.vue'),
      },
      {
        path: 'narrations',
        name: 'AdminNarrationsModeration',
        component: () => import('@/modules/admin/views/AdminNarrationsModerationStub.vue'),
      },
      {
        path: 'media',
        name: 'AdminMediaReview',
        component: () => import('@/modules/admin/views/AdminMediaReviewStub.vue'),
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
  },
];

export default v2Routes;

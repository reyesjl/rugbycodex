import type { RouteRecordRaw } from 'vue-router';

export const v2Routes: RouteRecordRaw[] = [
  {
    path: '/v2',
    component: () => import('@/layouts/v2/AppLayout.vue'),
    meta: { layout: 'app', requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'V2Dashboard',
        component: () => import('@/modules/app/views/DashboardStub.vue'),
      },
      {
        path: 'narrations',
        name: 'V2MyNarrations',
        component: () => import('@/modules/app/views/MyNarrationsStub.vue'),
      },
      {
        path: 'media',
        name: 'V2MyMedia',
        component: () => import('@/modules/app/views/MyMediaStub.vue'),
      },
      {
        path: 'organizations',
        name: 'V2Organizations',
        component: () => import('@/modules/app/views/Organizations.vue'),
      },
      {
        path: 'profile/:username?',
        name: 'V2Profile',
        component: () => import('@/modules/app/views/ProfileStub.vue'),
        props: true,
      },
      {
        path: 'settings',
        name: 'V2Settings',
        component: () => import('@/modules/profiles/views/ProfileSettings.vue'),
      },
    ],
  },
  {
    path: '/v2/orgs/:slug',
    component: () => import('@/layouts/v2/OrgLayout.vue'),
    meta: { layout: 'org', requiresAuth: true },
    children: [
      {
        path: '',
        name: 'V2OrgHome',
        redirect: { name: 'V2OrgOverview' },
      },
      {
        path: 'overview',
        name: 'V2OrgOverview',
        component: () => import('@/modules/orgs/views/OrgOverviewStub.vue'),
        props: true,
      },
      {
        path: 'vaults',
        name: 'V2OrgVaults',
        component: () => import('@/modules/orgs/views/OrgVaultsStub.vue'),
        props: true,
      },
      {
        path: 'narrations',
        name: 'V2OrgNarrations',
        component: () => import('@/modules/orgs/views/OrgNarrationsStub.vue'),
        props: true,
      },
      {
        path: 'media',
        name: 'V2OrgMedia',
        component: () => import('@/modules/orgs/views/OrgMedia.vue'),
        props: true,
      },
      {
        path: 'media/:assetId',
        name: 'V2OrgMediaAsset',
        component: () => import('@/modules/orgs/views/OrgMediaAssetView.vue'),
        props: true,
      },
      {
        path: 'members',
        name: 'V2OrgMembers',
        component: () => import('@/modules/orgs/views/OrgMembersStub.vue'),
        props: true,
      },
      {
        path: 'settings',
        name: 'V2OrgSettings',
        component: () => import('@/modules/orgs/views/OrgSettingsStub.vue'),
        props: true,
      },
      {
        path: 'admin',
        name: 'V2OrgAdminTools',
        component: () => import('@/modules/orgs/views/OrgAdminToolsStub.vue'),
        props: true,
      },
    ],
  },
  {
    path: '/v2/admin',
    component: () => import('@/layouts/v2/AdminLayout.vue'),
    meta: { layout: 'admin', requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: '',
        name: 'V2AdminOrgs',
        component: () => import('@/modules/admin/views/AdminOrgs.vue'),
      },
      {
        path: 'users',
        name: 'V2AdminUsers',
        component: () => import('@/modules/admin/views/AdminUsers.vue'),
      },
      {
        path: 'narrations',
        name: 'V2AdminNarrationsModeration',
        component: () => import('@/modules/admin/views/AdminNarrationsModerationStub.vue'),
      },
      {
        path: 'media',
        name: 'V2AdminMediaReview',
        component: () => import('@/modules/admin/views/AdminMediaReviewStub.vue'),
      },
      {
        path: 'jobs',
        name: 'V2AdminJobs',
        component: () => import('@/modules/admin/views/AdminJobsStub.vue'),
      },
      {
        path: 'billing',
        name: 'V2AdminBilling',
        component: () => import('@/modules/admin/views/AdminBillingStub.vue'),
      },
      {
        path: 'flags',
        name: 'V2AdminFeatureFlags',
        component: () => import('@/modules/admin/views/AdminFeatureFlagsStub.vue'),
      },
      {
        path: 'experiments',
        name: 'V2AdminExperiments',
        component: () => import('@/modules/admin/views/AdminExperimentsStub.vue'),
      },
    ],
  },
];

export default v2Routes;

import type { RouteRecordRaw } from 'vue-router';

export const v2Routes: RouteRecordRaw[] = [
  {
    path: '/v2/marketing',
    component: () => import('@/layouts/v2/MarketingLayout.vue'),
    meta: { layout: 'marketing' },
    children: [
      {
        path: '',
        name: 'V2MarketingHome',
        component: () => import('@/modules/marketing/views/MarketingHome.vue'),
      },
      {
        path: 'players',
        name: 'V2ForPlayers',
        component: () => import('@/modules/marketing/views/ForPlayers.vue'),
      },
      {
        path: 'coaches',
        name: 'V2ForCoaches',
        component: () => import('@/modules/marketing/views/ForCoaches.vue'),
      },
      {
        path: 'unions',
        name: 'V2ForUnions',
        component: () => import('@/modules/marketing/views/ForUnions.vue'),
      },
      {
        path: 'mission',
        name: 'V2Mission',
        component: () => import('@/modules/marketing/views/Mission.vue'),
      }
    ],
  },
  { 
    path: '/v2/auth',
    component: () => import('@/layouts/v2/AuthLayout.vue'),
    meta: { layout: 'auth' },
    children: [
      {
        path: 'login',
        name: 'V2Login',
        component: () => import('@/modules/auth/views/Login.vue'),
      },
      { 
        path: 'signup',
        name: 'V2Signup',
        component: () => import('@/modules/auth/views/Signup.vue'),
      }
    ],
  },
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
        component: () => import('@/modules/app/views/OrganizationsStub.vue'),
      },
      {
        path: 'profile/:profileId?',
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
        component: () => import('@/modules/orgs/views/OrgMediaStub.vue'),
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
        name: 'V2AdminOverview',
        component: () => import('@/modules/admin/views/AdminOverview.vue'),
      },
      {
        path: 'orgs',
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

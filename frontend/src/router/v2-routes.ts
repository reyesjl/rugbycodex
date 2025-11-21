import type { RouteRecordRaw } from 'vue-router';

import AdminLayout from '@/layouts/v2/AdminLayout.vue';
import MainLayout from '@/layouts/v2/MainLayout.vue';
import MarketingLayout from '@/layouts/v2/MarketingLayout.vue';
import OrgLayout from '@/layouts/v2/OrgLayout.vue';
import AdminBillingStub from '@/modules/admin/views/AdminBillingStub.vue';
import AdminExperimentsStub from '@/modules/admin/views/AdminExperimentsStub.vue';
import AdminFeatureFlagsStub from '@/modules/admin/views/AdminFeatureFlagsStub.vue';
import AdminJobsStub from '@/modules/admin/views/AdminJobsStub.vue';
import AdminMediaReviewStub from '@/modules/admin/views/AdminMediaReviewStub.vue';
import AdminNarrationsModerationStub from '@/modules/admin/views/AdminNarrationsModerationStub.vue';
import AdminOrgsStub from '@/modules/admin/views/AdminOrgs.vue';
import AdminOverviewStub from '@/modules/admin/views/AdminOverview.vue';
import AdminUsersStub from '@/modules/admin/views/AdminUsers.vue';
import DashboardStub from '@/modules/app/views/DashboardStub.vue';
import MarketingHome from '@/modules/marketing/views/MarketingHome.vue';
import MyMediaStub from '@/modules/app/views/MyMediaStub.vue';
import MyNarrationsStub from '@/modules/app/views/MyNarrationsStub.vue';
import OrganizationsStub from '@/modules/app/views/OrganizationsStub.vue';
import ProfileStub from '@/modules/app/views/ProfileStub.vue';
import SettingsStub from '@/modules/profiles/views/ProfileSettings.vue';
import OrgAdminToolsStub from '@/modules/orgs/views/OrgAdminToolsStub.vue';
import OrgMediaStub from '@/modules/orgs/views/OrgMediaStub.vue';
import OrgMembersStub from '@/modules/orgs/views/OrgMembersStub.vue';
import OrgNarrationsStub from '@/modules/orgs/views/OrgNarrationsStub.vue';
import OrgOverviewStub from '@/modules/orgs/views/OrgOverviewStub.vue';
import OrgSettingsStub from '@/modules/orgs/views/OrgSettingsStub.vue';
import OrgVaultsStub from '@/modules/orgs/views/OrgVaultsStub.vue';

export const v2Routes: RouteRecordRaw[] = [
  {
    path: '/v2/marketing',
    component: MarketingLayout,
    meta: { layout: 'minimal' },
    children: [
      {
        path: '',
        name: 'V2MarketingHome',
        component: MarketingHome,
      },
    ],
  },
  {
    path: '/v2',
    component: MainLayout,
    meta: { layout: 'minimal', requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'V2Dashboard',
        component: DashboardStub,
      },
      {
        path: 'narrations',
        name: 'V2MyNarrations',
        component: MyNarrationsStub,
      },
      {
        path: 'media',
        name: 'V2MyMedia',
        component: MyMediaStub,
      },
      {
        path: 'organizations',
        name: 'V2Organizations',
        component: OrganizationsStub,
      },
      {
        path: 'profile',
        name: 'V2Profile',
        component: ProfileStub,
      },
      {
        path: 'settings',
        name: 'V2Settings',
        component: SettingsStub,
      },
    ],
  },
  {
    path: '/v2/orgs/:slug',
    component: OrgLayout,
    meta: { layout: 'minimal', requiresAuth: true },
    children: [
      {
        path: 'overview',
        name: 'V2OrgOverview',
        component: OrgOverviewStub,
        props: true,
      },
      {
        path: 'vaults',
        name: 'V2OrgVaults',
        component: OrgVaultsStub,
        props: true,
      },
      {
        path: 'narrations',
        name: 'V2OrgNarrations',
        component: OrgNarrationsStub,
        props: true,
      },
      {
        path: 'media',
        name: 'V2OrgMedia',
        component: OrgMediaStub,
        props: true,
      },
      {
        path: 'members',
        name: 'V2OrgMembers',
        component: OrgMembersStub,
        props: true,
      },
      {
        path: 'settings',
        name: 'V2OrgSettings',
        component: OrgSettingsStub,
        props: true,
      },
      {
        path: 'admin',
        name: 'V2OrgAdminTools',
        component: OrgAdminToolsStub,
        props: true,
      },
    ],
  },
  {
    path: '/v2/admin',
    component: AdminLayout,
    meta: { layout: 'minimal', requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: '',
        name: 'V2AdminOverview',
        component: AdminOverviewStub,
      },
      {
        path: 'orgs',
        name: 'V2AdminOrgs',
        component: AdminOrgsStub,
      },
      {
        path: 'users',
        name: 'V2AdminUsers',
        component: AdminUsersStub,
      },
      {
        path: 'narrations',
        name: 'V2AdminNarrationsModeration',
        component: AdminNarrationsModerationStub,
      },
      {
        path: 'media',
        name: 'V2AdminMediaReview',
        component: AdminMediaReviewStub,
      },
      {
        path: 'jobs',
        name: 'V2AdminJobs',
        component: AdminJobsStub,
      },
      {
        path: 'billing',
        name: 'V2AdminBilling',
        component: AdminBillingStub,
      },
      {
        path: 'flags',
        name: 'V2AdminFeatureFlags',
        component: AdminFeatureFlagsStub,
      },
      {
        path: 'experiments',
        name: 'V2AdminExperiments',
        component: AdminExperimentsStub,
      },
    ],
  },
];

export default v2Routes;

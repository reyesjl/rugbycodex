import type { RouteRecordRaw } from 'vue-router';

export const orgRoutes: RouteRecordRaw = {
  path: '/orgs/:slug',
  component: () => import('@/layouts/OrgLayout.vue'),
  meta: { layout: 'app', requiresAuth: true },
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
      component: () => import('@/modules/orgs/views/OrgMediaV2.vue'),
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
};

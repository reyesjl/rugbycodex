import { computed, watchEffect } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';

export type DashboardVariant =
    | 'booting'
    | 'admin'
    | 'onboarding'
    | 'orgLeader'
    | 'orgContributor';

export function useDashboardState() {
    const { isAdmin, isAuthenticated } = storeToRefs(useAuthStore());
    const myOrgs = useMyOrganizationsStore();
    const activeOrg = useActiveOrganizationStore();

    watchEffect(() => {
        if (!isAuthenticated.value) return;
        void myOrgs.load();
        void activeOrg.load();
    });

    const effectiveOrg = computed(() => activeOrg.active ?? myOrgs.fallbackOrg ?? null);

    const primaryRole = computed(() =>
        effectiveOrg.value?.membership.role ?? null
    );

    const variant = computed<DashboardVariant>(() => {
        if (!myOrgs.loaded) return 'booting';
        if (isAdmin.value) return 'admin';
        if (!myOrgs.hasOrganizations) return 'onboarding';
        if (!activeOrg.loaded) return 'booting';

        if (
            primaryRole.value === 'owner' || 
            primaryRole.value === 'manager' || 
            primaryRole.value === 'staff'
        ) { 
            return 'orgLeader'
        };

        return 'orgContributor';
    });

    return {
        variant,
        fallbackOrg: myOrgs.fallbackOrg,
        orgCount: myOrgs.membershipCount,
    };
}

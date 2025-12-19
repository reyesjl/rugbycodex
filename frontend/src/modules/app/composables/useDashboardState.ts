import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore';

export type DashboardVariant =
    | 'booting'
    | 'admin'
    | 'onboarding'
    | 'orgLeader'
    | 'orgContributor';

export function useDashboardState() {
    const { isAdmin } = storeToRefs(useAuthStore());
    const myOrgs = useMyOrganizationsStore();

    const primaryRole = computed(() =>
        myOrgs.primaryOrg?.membership.role ?? null
    );

    const variant = computed<DashboardVariant>(() => {
        if (!myOrgs.loaded) return 'booting';
        if (isAdmin.value) return 'admin';
        if (!myOrgs.hasOrganizations) return 'onboarding';

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
        primaryOrg: myOrgs.primaryOrg,
        orgCount: myOrgs.membershipCount,
    };
}

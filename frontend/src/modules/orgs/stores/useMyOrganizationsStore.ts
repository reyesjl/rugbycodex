import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { orgService } from '@/modules/orgs/services/orgServiceV2';
import type { UserOrganizationSummary } from '@/modules/orgs/types';


/**
 * Load and hold the current user’s org memberships + attached org summary.
 */
export const useMyOrganizationsStore = defineStore('myOrganizations', () => {
    const items = ref<UserOrganizationSummary[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const loaded = ref(false);

    const fallbackOrg = computed(() => items.value[0] ?? null);
    const hasOrganizations = computed(() => items.value.length > 0);
    const membershipCount = computed(() => items.value.length);

    /**
     * Load the user’s organizations.
     * @param opts force:refresh after join/create approval later
     */
    const load = async (opts?: { force?: boolean }) => {
        const force = opts?.force ?? false;
        if (loaded.value && !force) return;

        loading.value = true;
        error.value = null;

        try {
            items.value = await orgService.listUserOrganizations();
            loaded.value = true;
            console.log('Loaded user organizations', items.value);
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Unable to load organizations.';
            items.value = [];
            loaded.value = false;
        } finally {
            loading.value = false;
        }
    };

    const clear = () => {
        items.value = [];
        loading.value = false;
        error.value = null;
        loaded.value = false;
    };

    const refresh = async () => load({ force: true });

    return {
        items,
        loading,
        error,
        loaded,
        fallbackOrg,
        hasOrganizations,
        membershipCount,
        load,
        clear,
        refresh,
    };
});

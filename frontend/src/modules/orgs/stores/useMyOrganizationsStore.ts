import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { orgService } from '@/modules/orgs/services/orgServiceV2';
import type { UserOrganizationSummary } from '@/modules/orgs/types';


let loadToken = 0;


/**
 * Load and hold the current user’s org memberships + attached org summary.
 */
export const useMyOrganizationsStore = defineStore('myOrganizations', () => {
    const data = {
        items: ref<UserOrganizationSummary[]>([]),
        loaded: ref(false),
    };

    const status = {
        loading: ref(false),
        error: ref<string | null>(null),
    };

    const items = computed({
        get: () => data.items.value,
        set: (next) => {
            data.items.value = next;
        },
    });

    const loaded = computed({
        get: () => data.loaded.value,
        set: (next) => {
            data.loaded.value = next;
        },
    });

    const loading = computed({
        get: () => status.loading.value,
        set: (next) => {
            status.loading.value = next;
        },
    });

    const error = computed({
        get: () => status.error.value,
        set: (next) => {
            status.error.value = next;
        },
    });

    const fallbackOrg = computed(() => data.items.value[0] ?? null);
    const hasOrganizations = computed(() => data.items.value.length > 0);
    const membershipCount = computed(() => data.items.value.length);
    const isReady = computed(() => data.loaded.value && !status.loading.value);
    const itemsReadonly = computed(() => data.items.value);
    const loadedReadonly = computed(() => data.loaded.value);
    const loadingReadonly = computed(() => status.loading.value);
    const errorReadonly = computed(() => status.error.value);

    /**
     * Load the user’s organizations.
     * @param opts force:refresh after join/create approval later
     */
    const load = async (opts?: { force?: boolean }) => {
        const force = opts?.force ?? false;
        if (data.loaded.value && !force) return;

        const token = ++loadToken;

        status.loading.value = true;
        status.error.value = null;

        try {
            const nextItems = await orgService.listUserOrganizations();
            if (token !== loadToken) return;

            data.items.value = nextItems;
            data.loaded.value = true;
            console.log('Loaded user organizations', data.items.value);
        } catch (err) {
            if (token !== loadToken) return;

            status.error.value = err instanceof Error ? err.message : 'Unable to load organizations.';
            data.items.value = [];
            data.loaded.value = false;
        } finally {
            if (token === loadToken) {
                status.loading.value = false;
            }
        }
    };

    const clear = () => {
        loadToken++;

        data.items.value = [];
        data.loaded.value = false;
        status.loading.value = false;
        status.error.value = null;
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
        isReady,
        itemsReadonly,
        loadedReadonly,
        loadingReadonly,
        errorReadonly,
        load,
        clear,
        refresh,
    };
});

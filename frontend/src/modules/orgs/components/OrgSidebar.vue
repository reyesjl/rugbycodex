<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useActiveOrgStore } from '@/modules/orgs/stores/useActiveOrgStore';
import { useOrgCapabilities } from '@/modules/orgs/composables/useOrgCapabilities';
import type { MembershipRole } from '@/modules/profiles/types';

defineProps<{
        isOpen: boolean;
}>();
const emit = defineEmits<{
    (e: 'toggle-sidebar'): void;
}>();

const route = useRoute();
const authStore = useAuthStore();
const activeOrgStore = useActiveOrgStore();
const { isAdmin } = storeToRefs(authStore);
const { activeOrg, activeMembership, loading } = storeToRefs(activeOrgStore);

const membershipRole = computed(() => activeMembership.value?.org_role ?? null);
const { hasAccess } = useOrgCapabilities(membershipRole, isAdmin);

const routeSlug = computed(() => {
    const slugParam = route.params.slug;
    if (Array.isArray(slugParam)) {
        return slugParam[0];
    }
    return typeof slugParam === 'string' ? slugParam : undefined;
});

const orgSlug = computed(() => activeOrg.value?.slug ?? routeSlug.value);
const orgBasePath = computed(() => (orgSlug.value ? `/v2/orgs/${orgSlug.value}` : '/v2/orgs'));
const overviewLink = computed(() => (orgSlug.value ? `${orgBasePath.value}/overview` : '/v2/orgs'));

const navigationLinks = computed(() => {
    if (!orgSlug.value) {
        return [] as Array<{ label: string; icon: string; to: string }>;
    }

    const config: Array<{ label: string; icon: string; path: string; minRole?: MembershipRole }> = [
        { label: 'Overview', icon: 'carbon:dashboard', path: 'overview' },
        { label: 'Vaults', icon: 'carbon:data-enrichment', path: 'vaults', minRole: 'member' },
        { label: 'Media', icon: 'carbon:image', path: 'media', minRole: 'member' },
        { label: 'Narrations', icon: 'carbon:microphone', path: 'narrations', minRole: 'member' },
        { label: 'Members', icon: 'carbon:user-multiple', path: 'members', minRole: 'staff' },
        { label: 'Settings', icon: 'carbon:settings', path: 'settings', minRole: 'manager' },
        { label: 'Admin Tools', icon: 'carbon:tool-kit', path: 'admin', minRole: 'owner' },
    ];

    return config
        .filter((link) => hasAccess(link.minRole))
        .map((link) => ({
            label: link.label,
            icon: link.icon,
            to: `${orgBasePath.value}/${link.path}`,
        }));
});

const currentOrgName = computed(() => {
    if (loading.value) return 'Loading organization...';
    return activeOrg.value?.name ?? 'Select an organization';
});

const currentRole = computed(() => activeMembership.value?.org_role ?? '—');

const handleSidebarToggle = () => emit('toggle-sidebar');

</script>

<template>
    <div class="overflow-y-auto fixed top-[var(--main-nav-height)] left-0 text-white backdrop-blur bg-black/30 w-64 h-full z-50 border-r-1 border-white/30"
        :class="[ isOpen ? 'translate-x-0' : '-translate-x-full' ]"
    >
        <div class="container-lg h-full py-5">
            <nav>
                <ul class="space-y-1">
                    <li>
                        <RouterLink
                            to="/v2/dashboard"
                            class="flex w-full items-center px-4 py-2 rounded hover:bg-white/10"
                        >
                            <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5" />
                            Back to Dashboard
                        </RouterLink>
                    </li>
                    <li>
                        <button
                            type="button"
                            class="flex w-full items-center px-4 py-2 rounded hover:bg-white/10"
                            @click="handleSidebarToggle"
                        >
                            <Icon icon="carbon:side-panel-close" width="20" height="20" class="mr-5" />
                            Collapse
                        </button>
                    </li>

                    <!-- this org -->
                    <li class="pt-4">
                        <RouterLink
                            :to="overviewLink"
                            class="flex flex-col px-4 py-3 font-semibold hover:bg-white/10 rounded"
                        >
                            <div class="flex items-center justify-between gap-3 text-sm">
                                <span class="truncate">{{ currentOrgName }}</span>
                                <Icon icon="carbon:chevron-right" width="20" height="20" />
                            </div>
                            <div class="mt-1 text-xs text-white/70">Role: {{ currentRole }}</div>
                        </RouterLink>
                    </li>

                    <li
                        v-for="link in navigationLinks"
                        :key="link.to"
                    >
                        <RouterLink :to="link.to" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon :icon="link.icon" width="20" height="20" class="mr-5" />
                            {{ link.label }}
                        </RouterLink>
                    </li>
                </ul>
            </nav>
        </div>
    </div>
</template>

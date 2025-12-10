<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useActiveOrgStore } from '@/modules/orgs/stores/useActiveOrgStore';

const emit = defineEmits<{
        (e: 'toggle-sidebar'): void;
}>();

defineProps<{
        isOpen: boolean;
}>();

const route = useRoute();
const activeOrgStore = useActiveOrgStore();
const { activeOrg, activeMembership, loading } = storeToRefs(activeOrgStore);

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

    return [
        { label: 'Overview', icon: 'carbon:dashboard', to: `${orgBasePath.value}/overview` },
        { label: 'Vaults', icon: 'carbon:data-enrichment', to: `${orgBasePath.value}/vaults` },
        { label: 'Media', icon: 'carbon:image', to: `${orgBasePath.value}/media` },
        { label: 'Narrations', icon: 'carbon:microphone', to: `${orgBasePath.value}/narrations` },
        { label: 'Members', icon: 'carbon:user-multiple', to: `${orgBasePath.value}/members` },
        { label: 'Settings', icon: 'carbon:settings', to: `${orgBasePath.value}/settings` },
    ];
});

const currentOrgName = computed(() => {
    if (loading.value) return 'Loading organization...';
    return activeOrg.value?.name ?? 'Select an organization';
});

const currentRole = computed(() => activeMembership.value?.org_role ?? '—');

// const handleSidebarToggle = () => {
//     emit('toggle-sidebar');
// };
</script>

<template>
    <div class="overflow-y-auto fixed top-[var(--main-nav-height)] left-0 text-white backdrop-blur bg-black/30 w-64 h-full z-50 border-r-1 border-white/30"
        :class="[ isOpen ? 'translate-x-0' : '-translate-x-full' ]"
    >
        <div class="container-lg h-full py-5">
            <!-- <div class="flex items-center justify-end">
                <div class="flex">
                    <Icon @click="handleSidebarToggle" icon="carbon:close" width="25" height="25" class="w-full cursor-pointer"/>
                </div>
            </div> -->
            <nav>
                <ul class="space-y-1">
                    <li>
                        <RouterLink to="/v2/dashboard" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5"/>
                            Dashboard
                        </RouterLink>
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
                            <Icon :icon="link.icon" width="20" height="20" class="mr-5"/>
                            {{ link.label }}
                        </RouterLink>
                    </li>
                </ul>
            </nav>
        </div>
    </div>
</template>
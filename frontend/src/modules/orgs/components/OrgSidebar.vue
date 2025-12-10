<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { useProfileStore } from '@/modules/profiles/stores/useProfileStore';
import type { OrgMembership } from '@/modules/profiles/types';

const emit = defineEmits<{
    (e: 'toggle-sidebar'): void;
}>();

defineProps<{
    isOpen: boolean;
}>();

const profileStore = useProfileStore();
const { memberships, loadingProfile } = storeToRefs(profileStore);

const getOrganizationLink = (membership: OrgMembership) => {
    return membership.slug ? `/v2/orgs/${membership.slug}` : `/v2/orgs/${membership.org_id}`;
};

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
            <nav class="">
                <ul class="">
                    <li>
                        <RouterLink to="/v2/dashboard" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5"/>
                            Dashboard
                        </RouterLink>
                    </li>

                    <!-- this org -->
                    <li class="mt-5">
                        <RouterLink to="/v2/orgs" class="flex flex-col px-4 py-2 font-semibold hover:bg-white/10 rounded">
                            <!-- Name of the current active org -->
                            <!-- Truncated if too long with ... -->
                            <div class="flex items-center">
                                Current org...
                                <Icon icon="carbon:chevron-right" width="20" height="20" class="ml-5"/>
                            </div>
                            <!-- this users role for this given active org -->
                            <div class="text-xs ">Role: </div>
                        </RouterLink>
                        
                    </li>

                    <li>
                        <RouterLink to="/v2/dashboard" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5"/>
                            Overview
                        </RouterLink>
                    </li>
                    <li>
                        <RouterLink to="/v2/dashboard" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5"/>
                            Media
                        </RouterLink>
                    </li>
                    <li>
                        <RouterLink to="/v2/dashboard" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5"/>
                            Clips
                        </RouterLink>
                    </li>
                    <li>
                        <RouterLink to="/v2/dashboard" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5"/>
                            Narrations
                        </RouterLink>
                    </li>
                    <li>
                        <RouterLink to="/v2/dashboard" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5"/>
                            Members
                        </RouterLink>
                    </li>
                    <li>
                        <RouterLink to="/v2/dashboard" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:chevron-left" width="20" height="20" class="mr-5"/>
                            Settings
                        </RouterLink>
                    </li>
                </ul>
            </nav>
        </div>
    </div>
</template>
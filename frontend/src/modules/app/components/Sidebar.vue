<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import { useProfileStore } from '@/modules/profiles/stores/useProfileStore';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import type { OrgMembership } from '@/modules/profiles/types';

defineProps<{
    isOpen: boolean;
}>();

const profileStore = useProfileStore();
const authStore = useAuthStore();
const { memberships, loadingProfile } = storeToRefs(profileStore);

const getOrganizationLink = (membership: OrgMembership) => {
    return membership.slug ? `/v2/orgs/${membership.slug}` : `/v2/orgs/${membership.org_id}`;
};

</script>

<template>
    <div class="overflow-y-auto fixed top-[var(--main-nav-height)] left-0 text-white backdrop-blur bg-black/30 w-64 h-full z-50 border-r-1 border-white/30"
        :class="[ isOpen ? 'translate-x-0' : '-translate-x-full' ]"
    >
        <div class="container-lg h-full py-5">
            <!-- <div class="flex items-center justify-end">
                <div class="flex">
                    <Icon @click="handleSidebarToggle" icon="carbon:close" width="25" height="25" class="w-full cursor-pointer" />
                </div>
            </div> -->
            <nav class="">
                <ul class="">
                    <li>
                        <RouterLink to="/v2/marketing" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:home" width="20" height="20" class="mr-5" />
                            Home
                        </RouterLink>
                    </li>
                    <li>
                        <RouterLink to="/v2/dashboard" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:dashboard" width="20" height="20" class="mr-5" />
                            Dashboard
                        </RouterLink>
                    </li>

                    <!-- orgs -->
                    <li class="mt-5">
                        <RouterLink to="/v2/organizations" class="flex items-center px-4 py-2 font-semibold hover:bg-white/10 rounded">
                            Organizations
                            <Icon icon="carbon:chevron-right" width="20" height="20" class="ml-5" />
                        </RouterLink>
                    </li>
                    <li
                        v-if="loadingProfile"
                        class="flex items-center px-4 py-2 text-white/50"
                    >
                        <Icon icon="carbon:circle-dash" width="20" height="20" class="mr-5 animate-spin" />
                        Loading organizations...
                    </li>
                    <li
                        v-else-if="memberships.length === 0"
                        class="flex items-center px-4 py-2 text-white/50"
                    >
                        <Icon icon="carbon:circle-dash" width="20" height="20" class="mr-5" />
                        No organizations yet
                    </li>
                    <template v-else>
                        <li
                            v-for="membership in memberships"
                            :key="membership.org_id"
                        >
                            <RouterLink
                                class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
                                :to="getOrganizationLink(membership)"
                            >
                                <Icon icon="carbon:circle-filled" width="20" height="20" class="mr-5" />
                                {{ membership.org_name }}
                            </RouterLink>
                        </li>
                    </template>

                    <!-- profile stuff -->
                     <li class="mt-5">
                        <RouterLink to="/v2/organizations" class="flex items-center px-4 py-2 font-semibold hover:bg-white/10 rounded">
                            You
                            <Icon icon="carbon:chevron-right" width="20" height="20" class="ml-5" />
                        </RouterLink>
                    </li>
                    <li>
                        <RouterLink to="/v2/profile" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:user-profile" width="20" height="20" class="mr-5" />
                            Profile
                        </RouterLink>
                    </li>
                    <li>
                        <RouterLink to="/v2/settings" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:settings" width="20" height="20" class="mr-5" />
                            Settings
                        </RouterLink>
                    </li>
                    <li v-if="authStore.isAdmin" class="mt-5">
                        <RouterLink to="/v2/admin" class="flex items-center px-4 py-2 text-amber-200 hover:bg-white/10 rounded">
                            <Icon icon="carbon:police" width="20" height="20" class="mr-5" />
                            Admin Console
                        </RouterLink>
                    </li>
                </ul>
            </nav>
        </div>
    </div>
</template>

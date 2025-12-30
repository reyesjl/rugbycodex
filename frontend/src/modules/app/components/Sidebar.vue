<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { RouterLink } from 'vue-router';
import { isPlatformAdmin } from "@/modules/auth/identity";
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { storeToRefs } from 'pinia';

defineProps<{
    isOpen: boolean;
}>();
const emit = defineEmits<{
    (e: 'toggle-sidebar'): void;
}>();

const handleSidebarToggle = () => emit('toggle-sidebar');

const activeOrgStore = useActiveOrganizationStore();
const { active, hasActiveOrg } = storeToRefs(activeOrgStore);

</script>

<template>
    <div class="overflow-y-auto fixed top-[var(--main-nav-height)] left-0 text-white backdrop-blur bg-black/30 w-64 h-full z-40 border-r-1 border-white/30"
        :class="[ isOpen ? 'translate-x-0' : '-translate-x-full' ]"
    >
        <div class="container-lg h-full py-5">
            <nav class="sidebar">
                <ul class="sidebar-list">
                    <li class="mb-6">
                        <div class="flex justify-between items-center">
                            <div class="text-lg select-none px-4">RUGBY<span class="font-semibold">CODEX</span></div>
                            <button
                                type="button"
                                class="flex items-center px-2 py-2 rounded hover:bg-white/10"
                                @click="handleSidebarToggle"
                            >
                                <Icon icon="carbon:side-panel-close" width="20" height="20" />
                                
                            </button>
                        </div>
                        
                    </li>

                    <template v-if="hasActiveOrg">
                        <li>
                            <RouterLink
                            :to="`/orgs/${active?.organization.slug}/media`"
                            class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
                            >
                            <Icon icon="carbon:image" width="20" height="20" class="mr-5" />
                            Media
                            </RouterLink>
                        </li>

                        <li>
                            <RouterLink
                            :to="`/orgs/${active?.organization.slug}/team`"
                            class="flex items-center px-4 py-2 hover:bg-white/10 rounded"
                            >
                            <Icon icon="carbon:user-multiple" width="20" height="20" class="mr-5" />
                            Team
                            </RouterLink>
                        </li>
                    </template>
                    
                    <li>
                        <RouterLink to="/" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:home" width="20" height="20" class="mr-5" />
                            Product
                        </RouterLink>
                    </li>
                    <li>
                        <RouterLink to="/dashboard" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:dashboard" width="20" height="20" class="mr-5" />
                            Dashboard
                        </RouterLink>
                    </li>
                    <!-- profile stuff -->
                     <li class="mt-5">
                        <RouterLink to="/profile" class="flex items-center px-4 py-2 font-semibold hover:bg-white/10 rounded">
                            You
                            <Icon icon="carbon:chevron-right" width="20" height="20" class="ml-5" />
                        </RouterLink>
                    </li>
                    <li>
                        <RouterLink to="/profile" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:user-profile" width="20" height="20" class="mr-5" />
                            Profile
                        </RouterLink>
                    </li>
                    <li>
                        <RouterLink to="/settings" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
                            <Icon icon="carbon:settings" width="20" height="20" class="mr-5" />
                            Settings
                        </RouterLink>
                    </li>
                    <li v-if="isPlatformAdmin()" class="mt-5">
                        <RouterLink to="/admin" class="flex items-center px-4 py-2 text-amber-200 hover:bg-white/10 rounded">
                            <Icon icon="carbon:police" width="20" height="20" class="mr-5" />
                            Admin Console
                        </RouterLink>
                    </li>
                </ul>
            </nav>
        </div>
    </div>
</template>

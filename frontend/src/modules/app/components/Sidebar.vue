<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { RouterLink } from 'vue-router';
import { isPlatformAdmin } from "@/modules/auth/identity";

defineProps<{
    isOpen: boolean;
}>();
const emit = defineEmits<{
    (e: 'toggle-sidebar'): void;
}>();

const handleSidebarToggle = () => emit('toggle-sidebar');

</script>

<template>
    <div class="overflow-y-auto fixed top-[var(--main-nav-height)] left-0 text-white backdrop-blur bg-black/30 w-64 h-full z-50 border-r-1 border-white/30"
        :class="[ isOpen ? 'translate-x-0' : '-translate-x-full' ]"
    >
        <div class="container-lg h-full py-5">
            <nav class="">
                <ul class="">
                    <li class="mb-2">
                        <button
                            type="button"
                            class="flex w-full items-center px-4 py-2 rounded hover:bg-white/10"
                            @click="handleSidebarToggle"
                        >
                            <Icon icon="carbon:side-panel-close" width="20" height="20" class="mr-5" />
                            Collapse
                        </button>
                    </li>
                    <li>
                        <RouterLink to="/" class="flex items-center px-4 py-2 hover:bg-white/10 rounded">
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
                            My Organizations
                            <Icon icon="carbon:chevron-right" width="20" height="20" class="ml-5" />
                        </RouterLink>
                    </li>
                    <!-- profile stuff -->
                     <li class="mt-5">
                        <RouterLink to="/v2/profile" class="flex items-center px-4 py-2 font-semibold hover:bg-white/10 rounded">
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
                    <li v-if="isPlatformAdmin()" class="mt-5">
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

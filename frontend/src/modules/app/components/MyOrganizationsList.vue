<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { UserOrganizationSummary } from '@/modules/orgs/types';
import type { Organization } from '@/modules/orgs/types';

interface Props {
    organizations: UserOrganizationSummary[];
}

const props = defineProps<Props>();

// Count of organizations
const membershipCount = computed(() => props.organizations.length);

// Singular/plural organization text
const organizationText = computed(() => {
    return membershipCount.value === 1 ? 'organization' : 'organizations';
});

// Group organizations by role, preserving full organization objects
const organizationsByRole = computed(() => {
    const roleMap = new Map<string, Organization[]>();
    
    props.organizations.forEach(item => {
        const role = item.membership.role;
        if (!roleMap.has(role)) {
            roleMap.set(role, []);
        }
        roleMap.get(role)!.push(item.organization);
    });
    
    return Array.from(roleMap.entries()).map(([role, orgs]) => ({
        role,
        organizations: orgs
    }));
});
</script>

<template>
    <section class="container-lg pt-10 text-white">
        <!-- Non-empty state -->
        <template v-if="membershipCount > 0">
            <div class="mb-2">
                You are part of {{ membershipCount }} {{ organizationText }}.
            </div>
            <div class="space-y-1">
                <div v-for="roleGroup in organizationsByRole" :key="roleGroup.role" class="text-sm text-white/80">
                    <span class="capitalize">{{ roleGroup.role }}</span> in 
                    <template v-for="(org, index) in roleGroup.organizations" :key="org.slug">
                        <RouterLink 
                            :to="`/organizations/${org.slug}`" 
                            class="underline hover:text-white hover:font-semibold hover:cursor-pointer"
                        >
                            {{ org.name }}
                        </RouterLink><span v-if="index < roleGroup.organizations.length - 1">, </span>
                    </template>
                </div>
            </div>
        </template>

        <!-- Empty state -->
        <template v-else>
            <div class="mb-2 text-white/80">
                You are not part of any organizations yet.
            </div>
            <RouterLink 
                to="/organizations" 
                class="text-sm underline hover:text-white hover:font-semibold hover:cursor-pointer"
            >
                Ask your team for a join code
            </RouterLink>
        </template>
    </section>
</template>

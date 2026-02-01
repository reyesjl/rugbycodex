<script setup lang="ts">
import { computed } from 'vue';
import { useProfileDisplay } from '@/modules/profiles/composables/useProfileDisplay';
import { useMyRugbyOrchestrator } from '@/modules/app/composables/useMyRugbyOrchestrator';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore';
import MyOrganizationsList from '@/modules/app/components/MyOrganizationsList.vue';
import MyAssignmentsList from '@/modules/app/components/MyAssignmentsList.vue';
import MyMomentsList from '@/modules/app/components/MyMomentsList.vue';

const { isEmptyState } = useMyRugbyOrchestrator();

const { username } = useProfileDisplay();

const myOrgsStore = useMyOrganizationsStore();

// Personalized greeting based on time of day
const greeting = computed(() => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
        return 'Good morning';
    }

    if (hour >= 12 && hour < 18) {
        return 'Good afternoon';
    }

    return 'Good evening';
});

</script>

<template>
    <div class="bg-linear-to-t from-black to-gray-800">
    <section class="container-lg space-y-8 py-10 text-white">
        <div class="text-4xl flex flex-col md:flex-row md:gap-1">
            <div>{{ greeting }},</div>
            <!-- <div>{{ name }}</div> -->
            <div class="text-white/70 tracking-wider">{{ username ? `@${username}` : 'new user' }}</div>
        </div>
    </section>

    <!-- Organization quicklook -->
    <MyOrganizationsList :organizations="myOrgsStore.items" />

    <section class="container-lg text-white pt-20">
        <div class="text-2xl font-semibold">Your moments</div>
        <div class="pt-4">
            <div v-if="isEmptyState" class="text-xs text-white/40">
                This section will fill in once your team starts uploading matches and adding feedback.
            </div>
            <MyMomentsList v-else />
        </div>
    </section>

    <!-- Your tasks - Assignments -->
    <MyAssignmentsList />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProfileDisplay } from '@/modules/profiles/composables/useProfileDisplay';
import { useMyRugbyOrchestrator } from '@/modules/app/composables/useMyRugbyOrchestrator';
import { useMyRugbyViewContext } from '@/modules/app/composables/useMyRugbyViewContext';
import ViewContextSwitcher from '@/modules/app/components/ViewContextSwitcher.vue';
import MyOrganizationsList from '@/modules/app/components/MyOrganizationsList.vue';
import MyAssignmentsList from '@/modules/app/components/MyAssignmentsList.vue';
import MyMomentsList from '@/modules/app/components/MyMomentsList.vue';
import ManagerMatchesList from '@/modules/app/components/ManagerMatchesList.vue';
import ManagerAssignmentsList from '@/modules/app/components/ManagerAssignmentsList.vue';

const { isEmptyState } = useMyRugbyOrchestrator();

const { username } = useProfileDisplay();

const { viewContext, canSwitchContext, contextFilteredOrgs, setViewContext } = useMyRugbyViewContext();

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

// Dynamic background gradient based on view context
const backgroundClass = computed(() => {
    return viewContext.value === 'manager' 
        ? 'bg-gradient-to-t from-black to-gray-800'
        : 'bg-gradient-to-t from-black to-red-900/40';
});

</script>

<template>
    <div :class="backgroundClass">
    <section class="container-lg space-y-8 py-10 text-white">
        <div class="text-4xl flex flex-col md:flex-row md:gap-1">
            <div>{{ greeting }},</div>
            <div class="text-white/70 tracking-wider">{{ username ? `@${username}` : 'new user' }}</div>
        </div>

        <!-- View Context Switcher -->
        <ViewContextSwitcher 
            :current-context="viewContext" 
            :can-switch="canSwitchContext"
            @switch="setViewContext"
        />
    </section>

    <!-- Organization quicklook -->
    <MyOrganizationsList :organizations="contextFilteredOrgs" />

    <!-- Player View -->
    <template v-if="viewContext === 'player'">
        <section class="container-lg text-white pt-20">
            <div v-if="isEmptyState" class="text-xs text-white/40">
                This section will fill in once your team starts uploading matches and adding feedback.
            </div>
            <MyMomentsList v-else />
        </section>

        <!-- Your tasks - Assignments -->
        <MyAssignmentsList />
    </template>

    <!-- Manager View -->
    <template v-else-if="viewContext === 'manager'">
        <ManagerMatchesList />
        <ManagerAssignmentsList />
    </template>
    </div>
</template>

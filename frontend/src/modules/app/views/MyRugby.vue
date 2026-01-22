<script setup lang="ts">
import { computed, ref } from 'vue';
import { useProfileDisplay } from '@/modules/profiles/composables/useProfileDisplay';
import { useMyRugbyOrchestrator } from '@/modules/app/composables/useMyRugbyOrchestrator';
import PersonalWorkOnsCard from '@/modules/app/components/PersonalWorkOnsCard.vue';
import CoachFocusCard from '../components/CoachFocusCard.vue';
import DemoMyRugbyCard from '@/modules/app/components/DemoMyRugbyCard.vue';

const { mode, isEmptyState } = useMyRugbyOrchestrator();
const workOnsCollapsed = ref(false)

const { username } = useProfileDisplay();

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
    <section class="container-lg space-y-8 pt-6 pb-10 text-white">
        <div class="text-4xl flex flex-col">
            <div>{{ greeting }},</div>
            <div class="text-white/60 tracking-wider">{{ username ? `@${username}` : 'new user' }}</div>
        </div>
    </section>

    <section class="container-lg text-white space-y-4">
        <PersonalWorkOnsCard
            v-if="mode === 'player' && !isEmptyState"
            :collapsible="true"
            :collapsed="workOnsCollapsed"
            @toggle="workOnsCollapsed = !workOnsCollapsed"
        />
        <CoachFocusCard
            v-if="mode === 'coach' && !isEmptyState"
            :collapsible="true"
            :collapsed="workOnsCollapsed"
            @toggle="workOnsCollapsed = !workOnsCollapsed"
        />
        <DemoMyRugbyCard
            v-if="isEmptyState"
        />
    </section>

    <section class="container-lg text-white pt-20">
        <div class="text-2xl font-semibold">Recent activity</div>
        <div class="pt-4">
            <div v-if="isEmptyState" class="text-xs text-white/40">
                This section will fill in once your team starts uploading matches and adding feedback.
            </div>
            <div v-else>
                <div class="text-xs text-white/30">Nothing for you to review here. You're all caught up!</div>
            </div>
        </div>
    </section>

    <section class="container-lg text-white pt-20">
        <div class="text-2xl font-semibold">Your moments</div>
        <div class="pt-4">
            <div v-if="isEmptyState" class="text-xs text-white/40">
                This section will fill in once your team starts uploading matches and adding feedback.
            </div>
            <div v-else>
                <div class="text-xs text-white/30">No moments were found. Start capturing your highlights with the "That's me" button!</div>
            </div>
        </div>
    </section>

    <section class="container-lg text-white py-20">
        <div class="text-2xl font-semibold">Your tasks</div>
        <div class="pt-4">
            <div v-if="isEmptyState" class="text-xs text-white/40">
                This section will fill in once your team starts uploading matches and adding feedback.
            </div>
            <div v-else>
                <div class="text-xs text-white/30">You've watched all the clips assigned to you! Nice work!</div>
            </div>
        </div>
    </section>
</template>

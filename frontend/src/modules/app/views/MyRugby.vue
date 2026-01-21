<script setup lang="ts">
import { computed, ref } from 'vue';
import { watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/useAuthStore'
import { useProfileDisplay } from '@/modules/profiles/composables/useProfileDisplay';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore'
import { toast } from '@/lib/toast'
import PersonalWorkOnsCard from '@/modules/app/components/PersonalWorkOnsCard.vue'

const router = useRouter()
const authStore = useAuthStore()
const myOrgs = useMyOrganizationsStore()

const { isAuthenticated, isAdmin } = storeToRefs(authStore)
const { loaded, hasOrganizations } = storeToRefs(myOrgs)

const hasShownRedirectToast = ref(false)
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

// Behavior change: redirect to onboarding if no orgs exist.
watchEffect(() => {
    if (!isAuthenticated.value) return
    if (!loaded.value) return
    if (isAdmin.value) return

    if (!hasOrganizations.value) {
        if (!hasShownRedirectToast.value) {
            // Behavior change: notify when redirecting to onboarding due to no orgs.
            toast({
                variant: 'info',
                message: 'Join or create a workspace to start using My Rugby.',
                durationMs: 3000,
            })
            hasShownRedirectToast.value = true
        }
        void router.replace({ name: 'Onboarding' })
    }
})
</script>

<template>
    <section class="container-lg space-y-8 pt-6 pb-20 text-white">
        <div class="text-4xl flex flex-col">
            <div>{{ greeting }},</div>
            <div class="text-white/60 tracking-wider">{{ username ? `@${username}` : 'new user' }}</div>
        </div>
    </section>

    <section class="container-lg text-white">
        <PersonalWorkOnsCard
            :collapsible="true"
            :collapsed="workOnsCollapsed"
            @toggle="workOnsCollapsed = !workOnsCollapsed"
        />
    </section>

    <section class="container-lg text-white pt-40">
        <div class="text-3xl font-semibold">Recent activity</div>
        <div class="pt-4">
            <div class="text-xs text-white/30">Nothing for you to review here. You're all caught up!</div>
        </div>
    </section>

    <section class="container-lg text-white pt-40">
        <div class="text-3xl font-semibold">Your moments</div>
        <div class="pt-4">
            <div class="text-xs text-white/30">No moments were found. Start capturing your highlights with the "That's me" button!</div>
        </div>
    </section>

    <section class="container-lg text-white pt-40 pb-20">
        <div class="text-3xl font-semibold">Your tasks</div>
        <div class="pt-4">
            <div class="text-xs text-white/30">You've watched all the clips assigned to you! Nice work!</div>
        </div>
    </section>
</template>

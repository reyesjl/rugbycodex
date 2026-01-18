<script setup lang="ts">
import { computed, ref } from 'vue';
import { watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/useAuthStore'
import { useProfileDisplay } from '@/modules/profiles/composables/useProfileDisplay';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore'
import { toast } from '@/lib/toast'

const router = useRouter()
const authStore = useAuthStore()
const myOrgs = useMyOrganizationsStore()

const { isAuthenticated, isAdmin } = storeToRefs(authStore)
const { loaded, hasOrganizations } = storeToRefs(myOrgs)

const hasShownRedirectToast = ref(false)

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
    <section class="container-lg space-y-8 py-6 pb-50 text-white">
        <div class="text-4xl flex flex-col">
            <div>{{ greeting }},</div>
            <div class="text-white/60 tracking-wider">{{ username ? `@${username}` : 'new user' }}</div>
        </div>

        <div>
            <p class="mt-3 text-sm text-white/70">
                This space is yours and remains independent of any active organization context.
            </p>
        </div>
    </section>
</template>

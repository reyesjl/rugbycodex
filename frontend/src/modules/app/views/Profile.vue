<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useUserContextStore } from '@/modules/user/stores/useUserContextStore';
import { useProfileDisplay } from '@/modules/profiles/composables/useProfileDisplay';
import { formatMonthYear } from '@/lib/date';

const router = useRouter();
const authStore = useAuthStore();
const userContextStore = useUserContextStore();

const { profile, organizations, isLoading } = storeToRefs(userContextStore);
const { user } = storeToRefs(authStore);
const { displayName, initials, username } = useProfileDisplay();

const displayUsername = computed(() => {
  if (!username.value) return '';
  return `@${username.value}`;
});

const isAdmin = computed(() => profile.value?.role === 'admin');

const primaryOrg = computed(() => {
  if (!profile.value?.primary_org) return null;
  return organizations.value.find(org => org.organization.id === profile.value?.primary_org);
});

const memberSince = computed(() => {
  if (!profile.value?.creation_time) return null;
  return formatMonthYear(profile.value.creation_time);
});

const handleSignOut = async () => {
  await authStore.signOut();
  router.push('/auth/login');
};

onMounted(() => {
  // User context is loaded during auth initialization
  // Only load if somehow not loaded yet
  if (!userContextStore.isReady && !userContextStore.isLoading) {
    userContextStore.load();
  }
});
</script>

<template>
  <div class="text-white container pt-6 pb-12">
    <div class="space-y-8">
      <h1 class="text-3xl">Profile</h1>

      <!-- Loading State -->
      <div v-if="isLoading" class="rounded border border-white/15 bg-white/5 p-6">
        <p class="text-white/60">Loading profile...</p>
      </div>

      <!-- Profile Content -->
      <div v-else-if="profile" class="space-y-6">
        
        <!-- Identity Section -->
        <section class="rounded border border-white/15 bg-white/5 p-6 space-y-4">
          <h2 class="text-lg font-semibold">Identity</h2>
          
          <div class="flex items-start gap-4">
            <!-- Avatar / Initials -->
            <div class="shrink-0 w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-xl font-semibold">
              {{ initials }}
            </div>
            
            <!-- Identity Details -->
            <div class="flex-1 space-y-2">
              <div class="flex items-center gap-3">
                <span class="text-xl font-medium">{{ displayName }}</span>
                <span
                  v-if="isAdmin"
                  class="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400"
                >
                  Admin
                </span>
              </div>
              
              <div class="text-white/60 text-sm">{{ displayUsername }}</div>
              
              <div class="text-white/40 text-xs space-y-1">
                <div v-if="memberSince">Member since {{ memberSince }}</div>
                <div>{{ profile.xp }} XP</div>
                <div v-if="user?.email">{{ user.email }}</div>
              </div>
              
              <div v-if="primaryOrg" class="pt-2">
                <div class="text-xs text-white/50 uppercase tracking-wider">Primary Organization</div>
                <div class="text-sm text-white/80">{{ primaryOrg.organization.name }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Organizations & Access Section -->
        <section class="rounded border border-white/15 bg-white/5 p-6 space-y-4">
          <h2 class="text-lg font-semibold">Organizations & Access</h2>
          
          <div v-if="organizations.length === 0" class="text-white/60 text-sm">
            You are not a member of any organizations.
          </div>
          
          <div v-else class="space-y-2">
            <div
              v-for="org in organizations"
              :key="org.organization.id"
              class="flex items-center justify-between rounded-md border border-white/10 bg-white/5 p-3"
            >
              <div class="space-y-1">
                <div class="font-medium">{{ org.organization.name }}</div>
                <div class="text-xs text-white/50">{{ org.organization.slug }}</div>
              </div>
              <div class="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                {{ org.membership.role }}
              </div>
            </div>
          </div>
        </section>

        <!-- Activity & Presence Section -->
        <section class="rounded border border-white/15 bg-white/5 p-6 space-y-4">
          <h2 class="text-lg font-semibold">Activity & Presence</h2>
          
          <div class="text-white/60 text-sm">
            No activity recorded yet.
          </div>
        </section>

        <!-- Controls Section -->
        <section class="rounded border border-white/15 bg-white/5 p-6 space-y-4">
          <h2 class="text-lg font-semibold">Controls</h2>
          
          <div class="flex gap-3">
            <button
              @click="handleSignOut"
              class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 cursor-pointer text-xs transition"
            >
              Sign Out
            </button>
          </div>
        </section>
      </div>

      <!-- No Profile State -->
      <div v-else class="rounded border border-white/15 bg-white/5 p-6">
        <p class="text-white/60">Profile unavailable.</p>
      </div>
    </div>
  </div>
</template>

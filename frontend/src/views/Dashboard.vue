<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import NarrationDemo from '@/components/NarrationDemo.vue';
import { useProfileStore } from '@/stores/profile';
import AnimatedLink from '@/components/AnimatedLink.vue';

const authStore = useAuthStore();
const profileStore = useProfileStore();

const router = useRouter();
const signOutError = ref<string | null>(null);
const signingOut = ref(false);

const displayName = computed(() => {
  const metadataName = authStore.user?.user_metadata?.name as string | undefined;
  if (metadataName?.trim()) return metadataName;
  return authStore.user?.email ?? 'Rugbycodex Member';
});

const accountRole = computed(() => {
  const metadataRole = authStore.user?.user_metadata?.role as string | undefined;
  if (metadataRole?.trim()) return metadataRole;
  return 'User';
});

// Access organizations from the profile store
// Sort: owner first, then by join date descending
const userOrganizations = computed(() => {
  const list = [...profileStore.organizations];
  return list.sort((a, b) => {
    const aOwner = a.role.toLowerCase() === 'owner';
    const bOwner = b.role.toLowerCase() === 'owner';
    // Owner first
    if (aOwner !== bOwner) return aOwner ? -1 : 1;
    // Then by newest join date
    return b.join_date.getTime() - a.join_date.getTime();
  });
});

const hasOrganizations = computed(() => userOrganizations.value.length > 0);


const lastSignInAt = computed(() => authStore.user?.last_sign_in_at);
const userEmail = computed(() => authStore.user?.email ?? '—');

const handleSignOut = async () => {
  signingOut.value = true;
  signOutError.value = null;
  const { error } = await authStore.signOut();
  signingOut.value = false;
  if (error) {
    signOutError.value = error.message;
    return;
  }
  router.push({ name: 'Overview' });
};
</script>

<template>
  <section class="container flex min-h-screen flex-col gap-16 pt-32 pb-32">
    <header
      class="rounded-3xl bg-neutral-100/80 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:bg-neutral-900/70 dark:shadow-[0_40px_80px_rgba(15,23,42,0.35)]">
      <p class="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
        Rugbycodex
      </p>
      <h1 class="mt-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Welcome back, {{ displayName }} !
      </h1>
      <p class="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
        You’re all set up and ready to go. As new features roll out, you’ll find them right in your dashboard.</p>
      <div class="mt-8 flex flex-wrap gap-3">
        <RouterLink to="/settings"
          class="inline-flex items-center gap-2 rounded-2xl border border-neutral-900 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-900 transition hover:bg-neutral-900 hover:text-neutral-100 dark:border-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-100 dark:hover:text-neutral-900">
          Account settings
        </RouterLink>
        <button type="button"
          class="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
          @click="handleSignOut" :disabled="signingOut">
          <span v-if="signingOut"
            class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-200 border-t-transparent dark:border-neutral-700"></span>
          <span>{{ signingOut ? 'Signing out…' : 'Sign out' }}</span>
        </button>
      </div>
      <p v-if="signOutError" class="mt-4 text-sm text-rose-500 dark:text-rose-400">
        {{ signOutError }}
      </p>
    </header>

    <section class="grid gap-8 md:grid-cols-2">
      <article
        class="rounded-3xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
        <h2 class="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
          Account
        </h2>
        <dl class="mt-6 space-y-4 text-neutral-700 dark:text-neutral-200">
          <div>
            <dt class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
              Email
            </dt>
            <dd class="mt-1 text-lg font-medium">{{ userEmail }}</dd>
          </div>
          <div>
            <dt class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
              User Role
            </dt>
            <dd class="mt-1 break-all text-sm capitalize">{{ accountRole }}</dd>
          </div>
          <div>
            <dt class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
              Last Sign-In
            </dt>
            <dd class="mt-1 text-sm">
              {{ lastSignInAt ? new Date(lastSignInAt).toLocaleString() : '—' }}
            </dd>
          </div>
        </dl>
      </article>

      <article
        class="rounded-3xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
        <h2 class="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
          Next Steps
        </h2>
        <ul class="mt-6 space-y-3 text-neutral-600 dark:text-neutral-300">
          <li>Contribute by adding your own narrations.</li>
          <li>View your team's narrations and provide feedback.</li>
          <li>Organize clips into threads to map season-long progress.</li>
        </ul>
        <p class="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          We'll notify you by email as soon as new features unlock for your account.
        </p>
      </article>

      <article
        class="rounded-3xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-colors md:col-span-2 dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
        <h2 class="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
          Organizations
        </h2>
        
        <div v-if="profileStore.loadingOrganizations" class="mt-6">
          <div class="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <span class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-transparent dark:border-neutral-700"></span>
            <span>Loading organizations...</span>
          </div>
        </div>
        
        <ul v-else-if="hasOrganizations" class="mt-6 space-y-2 text-neutral-700 dark:text-neutral-200">
          <li v-for="org in userOrganizations" :key="org.slug" class="flex items-start justify-between gap-4">
            <div class="flex flex-wrap items-baseline gap-2">
              <AnimatedLink :to="`/organizations/${org.slug}`" :text="org.org_name" />
              <span class="text-sm text-neutral-500 dark:text-neutral-400">[{{ org.role.toUpperCase() }}]</span>
            </div>
            <span class="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
              Joined {{ org.join_date.toLocaleDateString() }}
            </span>
          </li>
        </ul>
        
        <p v-else class="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          You are not part of any organizations yet.
        </p>
      </article>
    </section>

    <!-- Narration Demo -->
    <NarrationDemo class="mt-8" />

    <!-- Release page link -->
    <p class="container text-center text-sm text-neutral-500 dark:text-neutral-400">
      Stay updated—visit the
      <RouterLink to="/releases"
        class="underline decoration-dotted underline-offset-4 transition hover:text-neutral-900 dark:hover:text-neutral-100">
        Releases page
      </RouterLink>
      often to read about the latest updates.
    </p>
  </section>
</template>

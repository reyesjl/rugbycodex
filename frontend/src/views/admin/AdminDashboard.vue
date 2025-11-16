<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';

const authStore = useAuthStore();

const signOutError = ref<string | null>(null);
const signingOut = ref(false);

const displayName = computed(() => {
  const metadataName = authStore.user?.user_metadata?.name as string | undefined;
  if (metadataName?.trim()) return metadataName;
  return authStore.user?.email ?? 'Rugbycodex Member';
});

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
        Welcome back, {{ displayName }}!
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

    <div
      class="rounded-3xl bg-neutral-100/80 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:bg-neutral-900/70 dark:shadow-[0_40px_80px_rgba(15,23,42,0.35)]">
      <p class="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
        Admin
      </p>
      <h2 class="mt-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Organization Management
      </h2>
      <p class="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
        Manage organizations, view details, and create new organizations.
      </p>
      <div class="mt-8 flex flex-wrap gap-3">
        <RouterLink to="/admin/organizations"
          class="inline-flex items-center gap-2 rounded-2xl border border-neutral-900 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-900 transition hover:bg-neutral-900 hover:text-neutral-100 dark:border-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-100 dark:hover:text-neutral-900">
          View Orgs
        </RouterLink>
        <RouterLink to="/admin/create-org"
          class="inline-flex items-center gap-2 rounded-2xl border border-neutral-900 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-900 transition hover:bg-neutral-900 hover:text-neutral-100 dark:border-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-100 dark:hover:text-neutral-900">
          Create Org
        </RouterLink>
      </div>
    </div>
  </section>
</template>
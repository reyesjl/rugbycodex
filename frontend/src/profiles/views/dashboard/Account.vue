<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

const userEmail = computed(() => authStore.user?.email ?? '—');
const accountRole = computed(() => {
  const metadataRole = authStore.user?.user_metadata?.role as string | undefined;
  if (metadataRole?.trim()) return metadataRole;
  return 'User';
});
const lastSignInAt = computed(() => authStore.user?.last_sign_in_at);
</script>

<template>
  <section class="grid gap-6 md:grid-cols-2">
    <article class="rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-900 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-neutral-100">
      <h3 class="text-sm font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Account
      </h3>
      <dl class="mt-6 space-y-4 text-sm">
        <div>
          <dt class="text-xs uppercase text-neutral-400 dark:text-neutral-500">Email</dt>
          <dd class="mt-1 text-base font-medium">{{ userEmail }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-neutral-400 dark:text-neutral-500">Role</dt>
          <dd class="mt-1 capitalize">{{ accountRole }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-neutral-400 dark:text-neutral-500">Last sign-in</dt>
          <dd class="mt-1">
            {{ lastSignInAt ? new Date(lastSignInAt).toLocaleString() : '—' }}
          </dd>
        </div>
      </dl>
    </article>
  </section>
</template>

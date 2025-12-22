<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/auth/stores/useAuthStore';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const form = reactive({
  password: '',
  confirmPassword: '',
});

const loading = ref(true);
const submitting = ref(false);
const supabaseError = ref<string | null>(null);
const initializationError = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const passwordMismatch = computed(
  () => Boolean(form.password) && Boolean(form.confirmPassword) && form.password !== form.confirmPassword,
);
const showPasswordMismatch = computed(() => Boolean(form.confirmPassword) && passwordMismatch.value);

const ensureSessionFromUrl = async () => {
  let code: string | null = null;

  if (typeof route.query.code === 'string' && route.query.code.length > 0) {
    code = route.query.code;
  } else if (typeof window !== 'undefined') {
    const hashFragment = window.location.hash?.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash ?? '';

    if (hashFragment) {
      const hashParams = new URLSearchParams(hashFragment);
      const hashCode = hashParams.get('code');
      if (hashCode) {
        code = hashCode;
        window.history.replaceState(
          window.history.state,
          document.title,
          `${window.location.pathname}${window.location.search}`,
        );
      }
    }
  }

  if (!code) return;

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    throw error;
  }
};

onMounted(async () => {
  loading.value = true;
  initializationError.value = null;
  supabaseError.value = null;

  try {
    const errorDescription =
      typeof route.query.error_description === 'string' ? route.query.error_description : null;
    if (errorDescription) {
      throw new Error(errorDescription);
    }

    await ensureSessionFromUrl();

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    if (!data.session) {
      throw new Error('Password reset link is invalid or has expired. Please request a new one.');
    }
  } catch (error) {
    initializationError.value =
      error instanceof Error ? error.message : 'Unable to validate your password reset link.';
  } finally {
    loading.value = false;
  }
});

watch(
  () => [form.password, form.confirmPassword],
  () => {
    if (supabaseError.value === 'Passwords do not match.' && !passwordMismatch.value) {
      supabaseError.value = null;
    }
  },
);

const handleSubmit = async () => {
  if (loading.value || submitting.value) return;

  if (passwordMismatch.value) {
    supabaseError.value = 'Passwords do not match.';
    return;
  }

  submitting.value = true;
  supabaseError.value = null;
  successMessage.value = null;

  const newPassword = form.password.trim();
  if (!newPassword) {
    supabaseError.value = 'Please enter a new password.';
    submitting.value = false;
    return;
  }

  const { error } = await authStore.updatePassword(newPassword);
  submitting.value = false;

  if (error) {
    supabaseError.value = error.message ?? 'Unable to update your password. Please try again.';
    return;
  }

  successMessage.value = 'Password updated successfully. Redirecting you to your dashboard…';
  form.password = '';
  form.confirmPassword = '';

  setTimeout(() => {
    void router.push({ name: 'Dashboard' });
  }, 1500);
};
</script>

<template>
  <section class="container flex min-h-screen items-center justify-center pt-24 pb-24">
    <div class="w-full max-w-lg space-y-10">
      <RouterLink to="/"
        class="mx-auto inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
        Home
      </RouterLink>
      <header class="space-y-3 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
          Rugbycodex
        </p>
        <h1 class="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Choose a new password</h1>
        <p class="text-neutral-600 dark:text-neutral-400">
          Enter and confirm your new password to finish resetting access to your account.
        </p>
      </header>

      <div v-if="loading"
        class="rounded-3xl border border-neutral-200/60 bg-white/80 p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
        <p class="text-sm text-neutral-600 dark:text-neutral-300">Validating your reset link…</p>
      </div>

      <div v-else-if="initializationError"
        class="rounded-3xl border border-rose-300/60 bg-rose-50/80 p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-rose-900/70 dark:bg-rose-950/70 dark:text-rose-100 dark:shadow-[0_24px_60px_rgba(76,5,25,0.35)]">
        <p class="text-sm">{{ initializationError }}</p>
        <RouterLink to="/reset-password"
          class="mt-6 inline-flex items-center justify-center rounded-full border border-rose-400 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100/80 dark:border-rose-300/70 dark:text-rose-100 dark:hover:bg-rose-900/40">
          Request a new reset link
        </RouterLink>
      </div>

      <form v-else @submit.prevent="handleSubmit"
        class="rounded-3xl border border-neutral-200/60 bg-white/80 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-md transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
        <div class="space-y-6">
          <div class="space-y-2">
            <label for="new-password" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              New password
            </label>
            <input id="new-password" v-model="form.password" type="password" autocomplete="new-password" minlength="6"
              required
              class="block w-full rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/30" />
          </div>

          <div class="space-y-2">
            <label for="confirm-new-password" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Confirm password
            </label>
            <input id="confirm-new-password" v-model="form.confirmPassword" type="password" autocomplete="new-password"
              minlength="6" required
              class="block w-full rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/30" />
            <p v-if="showPasswordMismatch" class="text-sm text-rose-500 dark:text-rose-400">Passwords do not match.</p>
          </div>
        </div>

        <p v-if="supabaseError" class="mt-6 text-sm text-rose-500 dark:text-rose-400">
          {{ supabaseError }}
        </p>
        <p v-else-if="successMessage" class="mt-6 text-sm text-emerald-600 dark:text-emerald-300">
          {{ successMessage }}
        </p>

        <button type="submit"
          class="mt-10 inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
          :disabled="submitting || passwordMismatch">
          {{ submitting ? 'Updating…' : 'Update password' }}
        </button>
      </form>
    </div>
  </section>
</template>

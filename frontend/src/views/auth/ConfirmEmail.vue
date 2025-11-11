<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const hasError = ref(false);
const errorMessage = ref<string | null>(null);
const email = ref('');
const resending = ref(false);
const resendSuccessMessage = ref<string | null>(null);
const resendErrorMessage = ref<string | null>(null);
const confirmationRedirectUrl =
  typeof window !== 'undefined' ? `${window.location.origin}/confirm-email` : undefined;

if (typeof window !== 'undefined') {
  const fragment = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(fragment);
  const error = params.get('error');
  if (error) {
    hasError.value = true;
    errorMessage.value = params.get('error_description') ?? 'Unable to verify your email. The link may have expired.';
  }

  const emailParam = params.get('email');
  if (emailParam) {
    email.value = emailParam;
  }
}

const handleResend = async () => {
  if (!email.value || resending.value) return;
  resending.value = true;
  resendSuccessMessage.value = null;
  resendErrorMessage.value = null;

  try {
    const { error } = await authStore.resendConfirmationEmail(email.value, confirmationRedirectUrl);
    if (error) {
      resendErrorMessage.value = error.message ?? 'Unable to resend confirmation email.';
      return;
    }
    resendSuccessMessage.value =
      'We just sent a fresh confirmation email. Check your inbox and spam folder.';
  } finally {
    resending.value = false;
  }
};

watch(email, () => {
  resendSuccessMessage.value = null;
  resendErrorMessage.value = null;
});
</script>

<template>
  <section class="container flex min-h-screen items-center justify-center pt-24 pb-24">
    <div class="w-full max-w-lg space-y-10 text-center">
      <RouterLink
        to="/"
        class="mx-auto inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        Home
      </RouterLink>

      <header class="space-y-3">
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
          Rugbycodex
        </p>
        <h1 class="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
          {{ hasError ? 'Confirmation link expired' : 'Email confirmed' }}
        </h1>
        <p class="text-neutral-600 dark:text-neutral-400">
          {{
            hasError
              ? errorMessage ??
                'Unable to verify your email address. The confirmation link may be invalid or expired.'
              : 'Thanks for verifying your email address. You can now sign in and start exploring the platform.'
          }}
        </p>
      </header>

      <div
        class="rounded-3xl border border-neutral-200/60 bg-white/80 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-md transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]"
      >
        <template v-if="hasError">
          <p class="text-sm text-neutral-600 dark:text-neutral-300">
            Enter your email below and we'll send a fresh confirmation link.
          </p>
          <form class="mt-6 space-y-4" @submit.prevent="handleResend">
            <div class="space-y-2 text-left">
              <label for="email" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">Email</label>
              <input
                id="email"
                v-model="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                required
                class="block w-full rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/30"
              />
            </div>

            <button
              type="submit"
              class="inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
              :disabled="resending"
            >
              {{ resending ? 'Sending…' : 'Resend confirmation email' }}
            </button>

            <p v-if="resendSuccessMessage" class="text-sm text-emerald-600 dark:text-emerald-400">
              {{ resendSuccessMessage }}
            </p>
            <p v-if="resendErrorMessage" class="text-sm text-rose-500 dark:text-rose-400">
              {{ resendErrorMessage }}
            </p>
          </form>

          <RouterLink
            to="/login"
            class="mt-8 inline-flex w-full items-center justify-center rounded-2xl border border-neutral-200/70 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700/70 dark:text-neutral-200 dark:hover:bg-neutral-900/60"
          >
            Back to login
          </RouterLink>
        </template>
        <template v-else>
          <p class="text-sm text-neutral-600 dark:text-neutral-300">
            Continue to the login page to access your account.
          </p>
          <RouterLink
            to="/login"
            class="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-100 transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Back to login
          </RouterLink>
        </template>
      </div>
    </div>
  </section>
</template>

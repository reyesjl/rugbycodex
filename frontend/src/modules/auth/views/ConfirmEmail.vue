<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';

const authStore = useAuthStore();
const hasError = ref(false);
const errorMessage = ref<string | null>(null);
const email = ref('');
const resending = ref(false);
const resendSuccessMessage = ref<string | null>(null);
const resendErrorMessage = ref<string | null>(null);
const confirmationRedirectUrl =
  typeof window !== 'undefined' ? `${window.location.origin}/auth/confirm-email` : undefined;

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
  <div class="space-y-8">
    <header class="space-y-2">
      <h1 class="text-xl font-semibold uppercase tracking-[0.3em] text-white">CONFIRM EMAIL</h1>
      <p class="text-sm text-neutral-400">
        {{
          hasError
            ? errorMessage ?? 'Confirmation link invalid or expired.'
            : 'Verify your email address to continue.'
        }}
      </p>
    </header>

    <div v-if="hasError" class="space-y-6">
      <p class="text-xs text-neutral-400">Enter your email to issue a new confirmation link.</p>
      <form class="space-y-4" @submit.prevent="handleResend">
        <div class="space-y-1">
          <label for="email" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            required
            class="block w-full border-b border-neutral-600 bg-transparent py-2 text-sm text-white placeholder:text-neutral-500 focus:border-white focus:outline-none"
          />
        </div>

        <button
          type="submit"
          class="inline-flex w-full items-center justify-center bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="resending"
        >
          {{ resending ? 'Sending…' : 'Commit resend' }}
        </button>

        <p v-if="resendSuccessMessage" class="text-xs text-emerald-400">
          {{ resendSuccessMessage }}
        </p>
        <p v-if="resendErrorMessage" class="text-xs text-rose-400">
          {{ resendErrorMessage }}
        </p>
      </form>

      <RouterLink
        to="/auth/login"
        class="inline-flex w-full items-center justify-center bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:opacity-90"
      >
        Back to login
      </RouterLink>
    </div>

    <div v-else class="space-y-4">
      <p class="text-xs text-neutral-400">
        Continue to the login page to access your account.
      </p>
      <RouterLink
        to="/auth/login"
        class="inline-flex w-full items-center justify-center bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:opacity-90"
      >
        Back to login
      </RouterLink>
    </div>
  </div>
</template>

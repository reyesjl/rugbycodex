<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import TurnstileVerification from '@/components/TurnstileVerification.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const form = reactive({
  email: '',
  password: '',
});

const turnstileToken = ref('');
const turnstileRequired = ref(false);
const turnstileRef = ref<InstanceType<typeof TurnstileVerification> | null>(null);

const loading = ref(false);
const errorMessage = ref<string | null>(null);
const needsConfirmation = ref(false);
const resendingConfirmation = ref(false);
const resendSuccessMessage = ref<string | null>(null);
const resendErrorMessage = ref<string | null>(null);
const confirmationRedirectUrl =
  typeof window !== 'undefined' ? `${window.location.origin}/auth/confirm-email` : undefined;

const resetSuccess = computed(() => route.query.reset === 'success');
const isSubmitDisabled = computed(() => loading.value || (turnstileRequired.value && !turnstileToken.value));

const redirectPath = () => {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/')) {
    return redirect;
  }
  // Behavior change: send logins through the landing resolver.
  return '/dashboard';
};

watch(
  () => authStore.isAuthenticated,
  (isAuthed) => {
    if (isAuthed) {
      router.replace(redirectPath());
    }
  },
  { immediate: true },
);

const handleSubmit = async () => {
  if (loading.value) return;
  loading.value = true;
  errorMessage.value = null;
  needsConfirmation.value = false;
  resendSuccessMessage.value = null;
  resendErrorMessage.value = null;

  if (turnstileRequired.value && !turnstileToken.value) {
    errorMessage.value = 'Please complete the verification challenge.';
    loading.value = false;
    return;
  }

  const { error } = await authStore.signIn(
    form.email,
    form.password,
    turnstileRequired.value ? turnstileToken.value : undefined,
  );
  loading.value = false;

  if (error) {
    const message = error.message ?? 'Unable to sign in. Please try again.';
    const requiresConfirmation = message.toLowerCase().includes('confirm');
    needsConfirmation.value = requiresConfirmation;
    errorMessage.value = requiresConfirmation
      ? 'Please confirm your email before signing in.'
      : message;
    turnstileRef.value?.reset();
    return;
  }

  router.push(redirectPath());
};

const handleResendConfirmation = async () => {
  if (!form.email || resendingConfirmation.value) return;
  if (turnstileRequired.value && !turnstileToken.value) {
    resendErrorMessage.value = 'Please complete the verification challenge.';
    return;
  }
  resendingConfirmation.value = true;
  resendSuccessMessage.value = null;
  resendErrorMessage.value = null;

  try {
    const { error } = await authStore.resendConfirmationEmail(
      form.email,
      confirmationRedirectUrl,
      turnstileRequired.value ? turnstileToken.value : undefined,
    );

    if (error) {
      resendErrorMessage.value = error.message ?? 'Unable to resend confirmation email.';
      turnstileRef.value?.reset();
    } else {
      resendSuccessMessage.value =
        'We just sent a new confirmation email. Check your inbox and spam folder.';
    }
  } finally {
    resendingConfirmation.value = false;
  }
};

watch(
  () => form.email,
  () => {
    needsConfirmation.value = false;
    resendSuccessMessage.value = null;
    resendErrorMessage.value = null;
  },
);
</script>

<template>
  <div class="space-y-8">
    <header class="space-y-2 text-center">
      <h1 class="text-lg font-semibold uppercase tracking-[0.3em] text-white">SYSTEM READY</h1>
      <p class="text-sm text-neutral-400">Authenticate to access the Rugbycodex system.</p>
      <p v-if="resetSuccess" class="text-xs text-emerald-400">
        Password updated. Sign in with your new credential.
      </p>
    </header>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div class="space-y-4">
        <div class="space-y-1">
          <label for="email" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
            Email
          </label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            inputmode="email"
            autocomplete="email"
            required
            class="block w-full border-b border-neutral-600 bg-transparent py-2 text-sm text-white placeholder:text-neutral-500 focus:border-white focus:outline-none"
          />
        </div>

        <div class="space-y-1">
          <label for="password" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
            Password
          </label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            required
            class="block w-full border-b border-neutral-600 bg-transparent py-2 text-sm text-white placeholder:text-neutral-500 focus:border-white focus:outline-none"
          />
        </div>
      </div>

      <TurnstileVerification
        class="mt-2 opacity-70"
        v-model:token="turnstileToken"
        v-model:required="turnstileRequired"
        ref="turnstileRef"
      />

      <div class="flex justify-end text-[11px] uppercase tracking-[0.2em] text-neutral-500">
        <RouterLink to="/auth/forgot-password" class="underline underline-offset-4 hover:text-white">
          Forgot password
        </RouterLink>
      </div>

      <p v-if="errorMessage" class="text-xs text-rose-400">
        {{ errorMessage }}
      </p>

      <div v-if="needsConfirmation" class="space-y-2 border-l border-neutral-700 pl-3 text-xs text-neutral-400">
        <p>Confirmation required before access.</p>
        <button
          type="button"
          class="font-semibold uppercase tracking-[0.2em] text-white underline underline-offset-4 transition hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="resendingConfirmation || (turnstileRequired && !turnstileToken)"
          @click="handleResendConfirmation"
        >
          {{ resendingConfirmation ? 'Sending…' : 'Resend confirmation email' }}
        </button>
        <p v-if="resendSuccessMessage" class="text-emerald-400">
          {{ resendSuccessMessage }}
        </p>
        <p v-if="resendErrorMessage" class="text-rose-400">
          {{ resendErrorMessage }}
        </p>
      </div>

      <span class="auth-submit-shell">
        <button
          type="submit"
          class="inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-black disabled:text-white disabled:opacity-100"
          :disabled="isSubmitDisabled"
        >
          <Icon v-if="isSubmitDisabled" icon="line-md:loading-loop" class="mr-2 h-4 w-4" />
          {{ loading ? 'Signing in…' : 'Commit' }}
        </button>
      </span>
    </form>

    <footer class="pt-4 text-xs text-neutral-500">
      Want access?
      <RouterLink to="/auth/waitlist" class="ml-1 font-semibold uppercase tracking-[0.2em] text-white">
        Create account
      </RouterLink>
    </footer>
  </div>
</template>

<style scoped>
.auth-submit-shell {
  position: relative;
  display: inline-flex;
  width: 100%;
  padding: 2px;
  border-radius: 9999px;
  overflow: hidden;
  background: linear-gradient(120deg, rgba(30, 64, 175, 0.95), rgba(96, 165, 250, 0.9), rgba(30, 64, 175, 0.95));
}

.auth-submit-shell::before {
  content: '';
  position: absolute;
  inset: -40%;
  background: linear-gradient(115deg, transparent 42%, rgba(255, 255, 255, 0.9) 50%, transparent 58%);
  transform: translateX(-120%) rotate(10deg);
  animation: auth-submit-shine-sweep 2.4s linear infinite;
}

.auth-submit-shell > button {
  position: relative;
  z-index: 1;
}

@keyframes auth-submit-shine-sweep {
  to {
    transform: translateX(120%) rotate(10deg);
  }
}
</style>

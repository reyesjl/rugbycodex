<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import TurnstileVerification from '@/components/TurnstileVerification.vue';
import bgImg from '@/assets/modules/auth/headingley.jpg';
import { useStaggeredFade } from '@/composables/useStaggeredFade';
import AuthNav from '../components/AuthNav.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const form = reactive({
  email: '',
  password: '',
});

const turnstileToken = ref('');
const turnstileRequired = ref(false);

const loading = ref(false);
const errorMessage = ref<string | null>(null);
const needsConfirmation = ref(false);
const resendingConfirmation = ref(false);
const resendSuccessMessage = ref<string | null>(null);
const resendErrorMessage = ref<string | null>(null);
const confirmationRedirectUrl =
  typeof window !== 'undefined' ? `${window.location.origin}/confirm-email` : undefined;

const { register: registerFadeItem } = useStaggeredFade();

const redirectPath = () => {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/')) {
    return redirect;
  }
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
    return;
  }

  router.push(redirectPath());
};

const handleResendConfirmation = async () => {
  if (!form.email || resendingConfirmation.value) return;
  resendingConfirmation.value = true;
  resendSuccessMessage.value = null;
  resendErrorMessage.value = null;

  try {
    const { error } = await authStore.resendConfirmationEmail(form.email, confirmationRedirectUrl);

    if (error) {
      resendErrorMessage.value = error.message ?? 'Unable to resend confirmation email.';
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
  <section class="relative h-screen">
    <!-- Background image -->
    <img :src="bgImg" alt="Background" class="fixed inset-0 h-full w-full object-cover" />
    
    <!-- Overlay -->
    <div class="fixed inset-0 bg-black/60"></div>

    <!-- Content -->
    <div class="relative z-10 max-w-xl mx-auto px-4">
      <!-- Small auth navigation -->
      <AuthNav />

      <div class="flex justify-center min-h-screen py-20">
        <div class="w-full">
          <div class="space-y-5">
            <h1 class="text-5xl md:text-8xl text-white" :ref="registerFadeItem">Welcome back.</h1>
          </div>
          <form @submit.prevent="handleSubmit" 
            class="mt-10 ">
            <div class="space-y-10">
              <div class="flex flex-col space-y-2" :ref="registerFadeItem">
                <label for="email" class="text-xs uppercase text-white">Email</label>
                <input id="email" v-model="form.email" type="email" inputmode="email" autocomplete="email" required
                  class="block w-full backdrop-blur bg-black/10 text-white border-b-2 border-white placeholder-white/30 px-2 py-1 outline-none" placeholder="user@rugbycodex.com" />
              </div>

              <div class="flex flex-col space-y-2" :ref="registerFadeItem">
                <label for="password" class="text-xs uppercase text-white">Password</label>
                <input id="password" v-model="form.password" type="password" autocomplete="current-password" required
                  class="block w-full backdrop-blur bg-black/10 text-white border-b-2 border-white placeholder-white/30 px-2 py-1 outline-none" placeholder="password" />
              </div>
            </div>

            
            <TurnstileVerification
            class="mt-6"
              v-model:token="turnstileToken"
              v-model:required="turnstileRequired"
            />

            <div class="mt-2 text-right text-sm" :ref="registerFadeItem">
              <RouterLink to="/reset-password"
                class="font-medium text-white underline underline-offset-4 transition ">
                Forgot your password?
              </RouterLink>
            </div>

            <p v-if="errorMessage" class="mt-6 text-sm text-rose-500 dark:text-rose-400">
              {{ errorMessage }}
            </p>

            <div v-if="needsConfirmation"
              class="mt-4 space-y-2 rounded-2xl bg-neutral-100/80 p-4 text-sm text-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-200">
              <p>Didn't receive the confirmation email?</p>
              <button type="button"
                class="font-semibold text-neutral-900 underline underline-offset-4 transition hover:text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-neutral-100 dark:hover:text-neutral-200"
                :disabled="resendingConfirmation" @click="handleResendConfirmation">
                {{ resendingConfirmation ? 'Sending…' : 'Resend confirmation email' }}
              </button>
              <p v-if="resendSuccessMessage" class="text-emerald-600 dark:text-emerald-400">
                {{ resendSuccessMessage }}
              </p>
              <p v-if="resendErrorMessage" class="text-rose-500 dark:text-rose-400">
                {{ resendErrorMessage }}
              </p>
            </div>

            <button type="submit" :ref="registerFadeItem"
              class="mt-10 inline-flex w-full items-center justify-center rounded-xs bg-white px-4 py-3 text-sm uppercase tracking-[0.2em] text-black"
              :disabled="loading || (turnstileRequired && !turnstileToken)">
              {{ loading ? 'Signing in…' : !turnstileToken ? 'Verifying…' : 'Log In' }}
            </button>
            
          </form>
          </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fade-item {
  opacity: 0;
  transform: translateY(30px);
  transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1);
}

.fade-item.visible {
  opacity: 1;
  transform: translateY(0);
}
</style>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import TurnstileVerification from '@/components/TurnstileVerification.vue';

const authStore = useAuthStore();

const form = reactive({
  email: '',
});

const sending = ref(false);
const successMessage = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const turnstileToken = ref('');
const turnstileRequired = ref(false);
const turnstileRef = ref<InstanceType<typeof TurnstileVerification> | null>(null);
const isSubmitDisabled = computed(() => sending.value || (turnstileRequired.value && !turnstileToken.value));

const handleSubmit = async () => {
  if (sending.value) return;
  sending.value = true;
  successMessage.value = null;
  errorMessage.value = null;

  const email = form.email.trim();

  if (!email) {
    errorMessage.value = 'Please enter the email associated with your account.';
    sending.value = false;
    return;
  }

  if (turnstileRequired.value && !turnstileToken.value) {
    errorMessage.value = 'Please complete the verification challenge.';
    sending.value = false;
    return;
  }

  const { error } = await authStore.resetPassword(
    email,
    undefined,
    turnstileRequired.value ? turnstileToken.value : undefined,
  );

  sending.value = false;

  if (error) {
    errorMessage.value = error.message ?? 'Unable to send reset instructions. Please try again.';
    turnstileRef.value?.reset();
    return;
  }

  successMessage.value = 'Check your email for a reset link. Follow the instructions to choose a new password.';
};
</script>

<template>
  <div class="space-y-8">
    <header class="space-y-2 text-center">
      <h1 class="text-xl font-semibold uppercase tracking-[0.3em] text-white">RESET ACCESS</h1>
      <p class="text-sm text-neutral-400">Enter your email to receive reset instructions.</p>
    </header>

    <form @submit.prevent="handleSubmit" class="space-y-6">
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

      <TurnstileVerification
        class="mt-2 opacity-70"
        v-model:token="turnstileToken"
        v-model:required="turnstileRequired"
        ref="turnstileRef"
      />

      <p v-if="errorMessage" class="text-xs text-rose-400">
        {{ errorMessage }}
      </p>
      <p v-else-if="successMessage" class="text-xs text-emerald-400">
        {{ successMessage }}
      </p>

      <span class="auth-submit-shell">
        <button
          type="submit"
          class="inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-black disabled:text-white disabled:opacity-100"
          :disabled="isSubmitDisabled"
        >
          <Icon v-if="isSubmitDisabled" icon="line-md:loading-loop" class="mr-2 h-4 w-4" />
          {{ sending ? 'Sending instructions…' : 'Commit reset' }}
        </button>
      </span>
    </form>

    <footer class="pt-4 text-xs text-neutral-500">
      Remembered your password?
      <RouterLink to="/auth/login" class="ml-1 font-semibold uppercase tracking-[0.2em] text-white">
        Back to login
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

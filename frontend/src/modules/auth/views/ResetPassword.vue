<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';

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

  successMessage.value = 'Password updated successfully. Redirecting you to sign in…';
  form.password = '';
  form.confirmPassword = '';

  setTimeout(() => {
    void router.push({ name: 'Login', query: { reset: 'success' } });
  }, 1500);
};
</script>

<template>
  <div class="space-y-8">
    <header class="space-y-2">
      <h1 class="text-xl font-semibold uppercase tracking-[0.3em] text-white">SET NEW PASSWORD</h1>
      <p class="text-sm text-neutral-400">Define a new access credential.</p>
    </header>

    <div v-if="loading" class="border-l border-neutral-700 pl-3 text-xs text-neutral-400">
      Validating reset link…
    </div>

    <div v-else-if="initializationError" class="space-y-4 border-l border-rose-500 pl-3 text-xs text-rose-400">
      <p>{{ initializationError }}</p>
      <RouterLink
        to="/auth/forgot-password"
        class="inline-flex w-full items-center justify-center bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:opacity-90"
      >
        Request new link
      </RouterLink>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <div class="space-y-4">
        <div class="space-y-1">
          <label for="new-password" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
            New password
          </label>
          <input
            id="new-password"
            v-model="form.password"
            type="password"
            autocomplete="new-password"
            minlength="6"
            required
            class="block w-full border-b border-neutral-600 bg-transparent py-2 text-sm text-white placeholder:text-neutral-500 focus:border-white focus:outline-none"
          />
        </div>

        <div class="space-y-1">
          <label for="confirm-new-password" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
            Confirm password
          </label>
          <input
            id="confirm-new-password"
            v-model="form.confirmPassword"
            type="password"
            autocomplete="new-password"
            minlength="6"
            required
            class="block w-full border-b border-neutral-600 bg-transparent py-2 text-sm text-white placeholder:text-neutral-500 focus:border-white focus:outline-none"
          />
          <p v-if="showPasswordMismatch" class="text-[11px] text-rose-400">Passwords do not match.</p>
        </div>
      </div>

      <p v-if="supabaseError" class="text-xs text-rose-400">
        {{ supabaseError }}
      </p>
      <p v-else-if="successMessage" class="text-xs text-emerald-400">
        {{ successMessage }}
      </p>

      <button
        type="submit"
        class="inline-flex w-full items-center justify-center bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="submitting || passwordMismatch"
      >
        {{ submitting ? 'Updating…' : 'Commit update' }}
      </button>
    </form>
  </div>
</template>

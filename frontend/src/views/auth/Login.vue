<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

if (!authStore.hydrated) {
  void authStore.initialize();
}

const form = reactive({
  email: '',
  password: '',
});

const loading = ref(false);
const errorMessage = ref<string | null>(null);

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

  const { error } = await authStore.signIn(form.email, form.password);
  loading.value = false;

  if (error) {
    errorMessage.value = error.message ?? 'Unable to sign in. Please try again.';
    return;
  }

  router.push(redirectPath());
};
</script>

<template>
  <section class="container flex min-h-screen items-center justify-center pt-24 pb-24">
    <div class="w-full max-w-lg space-y-10">
      <RouterLink
        to="/"
        class="mx-auto inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        Home
      </RouterLink>
      <header class="space-y-3 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
          Rugbycodex
        </p>
        <h1 class="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Welcome back</h1>
        <p class="text-neutral-600 dark:text-neutral-400">
          Sign in to continue shaping the knowledge base for your club and community.
        </p>
      </header>

      <form
        @submit.prevent="handleSubmit"
        class="rounded-3xl border border-neutral-200/60 bg-white/80 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-md transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]"
      >
        <div class="space-y-6">
          <div class="space-y-2">
            <label for="email" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">Email</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              inputmode="email"
              autocomplete="email"
              required
              class="block w-full rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/30"
            />
          </div>

          <div class="space-y-2">
            <label for="password" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">Password</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              required
              class="block w-full rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/30"
            />
          </div>
        </div>

        <p v-if="errorMessage" class="mt-6 text-sm text-rose-500 dark:text-rose-400">
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          class="mt-10 inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
          :disabled="loading"
        >
          {{ loading ? 'Signing in…' : 'Log In' }}
        </button>
      </form>

      <footer class="text-center text-sm text-neutral-500 dark:text-neutral-400">
        Need a Rugbycodex account? <br />
        <RouterLink
          to="/signup"
          class="font-medium text-neutral-700 underline-offset-4 transition hover:text-neutral-900 dark:text-neutral-200 dark:hover:text-neutral-100"
        >
          Request beta access
        </RouterLink>
      </footer>
    </div>
  </section>
</template>

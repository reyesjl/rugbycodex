<script setup lang="ts">
import { reactive } from 'vue';
import { RouterLink } from 'vue-router';

const form = reactive({
  email: '',
  username: '',
  password: '',
});

const handleSubmit = () => {
  // Intentionally blank – wire up to real auth flow when backend is ready.
  console.info('login form submitted', { ...form });
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
            <label for="username" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">Username</label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              autocomplete="username"
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

        <button
          type="submit"
          class="mt-10 inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-100 transition hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Log In
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

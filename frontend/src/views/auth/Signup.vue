<script setup lang="ts">
import { reactive, ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useAuthStore } from '@/stores/auth';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'invisible';
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      reset?: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

const turnstileTestKey = '1x00000000000000000000AA';

const turnstileSiteKey = import.meta.env.PROD
  ? import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''
  : import.meta.env.VITE_TURNSTILE_SITE_KEY_DEV ?? import.meta.env.VITE_TURNSTILE_SITE_KEY ?? turnstileTestKey;

const shouldRenderTurnstile = computed(() => Boolean(turnstileSiteKey));
const turnstileToken = ref('');
const turnstileScriptId = 'cloudflare-turnstile-script';
const turnstileContainer = ref<HTMLElement | null>(null);
const turnstileWidgetId = ref<string | null>(null);
const isDarkMode = ref(false);
const turnstileTheme = computed(() => (isDarkMode.value ? 'dark' : 'light'));
const authStore = useAuthStore();
const router = useRouter();
const signingUp = ref(false);
const supabaseError = ref<string | null>(null);
const supabaseMessage = ref<string | null>(null);

if (!authStore.hydrated) {
  void authStore.initialize();
}

let turnstileScriptPromise: Promise<void> | null = null;
let darkModeObserver: MutationObserver | null = null;

const appendTurnstileScript = () => {
  if (typeof document === 'undefined') return null;

  const existing = document.getElementById(turnstileScriptId) as HTMLScriptElement | null;
  if (existing) {
    return existing;
  }

  const script = document.createElement('script');
  script.id = turnstileScriptId;
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
  return script;
};

const ensureTurnstileScript = () => {
  if (typeof window === 'undefined' || !shouldRenderTurnstile.value) {
    return Promise.resolve();
  }

  if (window.turnstile) {
    return Promise.resolve();
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<void>((resolve) => {
    const script = appendTurnstileScript();
    if (!script) {
      resolve();
      return;
    }

    if (script.dataset.loaded === 'true') {
      resolve();
      return;
    }

    const onLoad = () => {
      script.dataset.loaded = 'true';
      resolve();
    };

    const onError = () => {
      turnstileScriptPromise = null;
      resolve();
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
  });

  return turnstileScriptPromise;
};

const syncDarkMode = () => {
  if (typeof document === 'undefined') return;
  isDarkMode.value = document.documentElement.classList.contains('dark');
};

const removeTurnstile = () => {
  if (typeof window === 'undefined') return;
  if (!turnstileWidgetId.value) return;
  window.turnstile?.remove?.(turnstileWidgetId.value);
  turnstileWidgetId.value = null;
  turnstileToken.value = '';
  if (turnstileContainer.value) {
    turnstileContainer.value.innerHTML = '';
  }
};

const mountTurnstile = async () => {
  if (!shouldRenderTurnstile.value) return;
  if (typeof window === 'undefined') return;
  await ensureTurnstileScript();
  if (!window.turnstile || !turnstileContainer.value) return;

  removeTurnstile();
  turnstileToken.value = '';
  turnstileContainer.value.innerHTML = '';

  turnstileWidgetId.value = window.turnstile.render(turnstileContainer.value, {
    sitekey: turnstileSiteKey,
    theme: turnstileTheme.value,
    size: 'normal',
    callback: (token: string) => {
      turnstileToken.value = token;
    },
  });
};

onMounted(async () => {
  if (!shouldRenderTurnstile.value) return;
  appendTurnstileScript();
  syncDarkMode();
  await nextTick();
  await mountTurnstile();

  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
    darkModeObserver = new MutationObserver(() => {
      syncDarkMode();
    });
    darkModeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
});

onBeforeUnmount(() => {
  removeTurnstile();
  darkModeObserver?.disconnect();
  darkModeObserver = null;
});

const form = reactive({
  name: '',
  email: '',
  password: '',
  phone: '',
  organization: '',
  role: '',
  usage: '',
  referral: '',
  honeypot: '',
});

const submissionLogged = ref(false);
const storageKey = 'betaRequests.csv';

const logSubmissionToLocalStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const quote = (value: string) => {
    const trimmed = value?.trim() ?? '';
    return `"${trimmed.replace(/"/g, '""')}"`;
  };

  const row = [
    quote(form.name),
    quote(form.email),
    quote(form.phone),
    quote(form.organization),
    quote(form.role),
    quote(form.usage),
    quote(form.referral),
    quote(new Date().toISOString()),
  ].join(',');

  const csvHeader = 'name,email,phone,organization,role,usage,referral,submitted_at';
  const existingLog = window.localStorage.getItem(storageKey);
  const nextLog = existingLog ? `${existingLog}\n${row}` : `${csvHeader}\n${row}`;
  window.localStorage.setItem(storageKey, nextLog);
};

watch(turnstileTheme, () => {
  void mountTurnstile();
});

const handleSubmit = async () => {
  if (shouldRenderTurnstile.value && !turnstileToken.value) {
    console.warn('turnstile verification is required before submitting');
    return;
  }

  // Naive CSV log written to localStorage for the current browser session.
  if (form.honeypot?.trim()) {
    console.warn('beta access request flagged as spam', { ...form });
    return;
  }

  signingUp.value = true;
  supabaseError.value = null;
  supabaseMessage.value = null;

  const metadata = {
    name: form.name,
    phone: form.phone,
    organization: form.organization,
    role: form.role,
    usage: form.usage,
    referral: form.referral,
  };

  const { data, error } = await authStore.signUp(form.email, form.password, metadata);

  if (error) {
    supabaseError.value = error.message ?? 'Something went wrong while creating your account.';
    signingUp.value = false;
    return;
  }

  logSubmissionToLocalStorage();

  if (data?.session) {
    supabaseMessage.value = 'Your account is ready. We will redirect you to the dashboard.';
    submissionLogged.value = true;
    await nextTick();
    await router.push({ name: 'Dashboard' });
    signingUp.value = false;
    return;
  }

  supabaseMessage.value =
    'Check your inbox to confirm your email. Once verified, you can sign in to your dashboard.';
  submissionLogged.value = true;
  console.info('beta access request logged', { ...form });
  signingUp.value = false;
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
        <h1 class="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Request Beta Access</h1>
        <p class="text-neutral-600 dark:text-neutral-400">
          Rugbycodex is currently in a closed beta. Tell us a bit about yourself so we can get you early access.
        </p>
      </header>

      <form v-if="!submissionLogged" @submit.prevent="handleSubmit"
        class="rounded-3xl border border-neutral-200/60 bg-white/80 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-md transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
        <div class="space-y-6">
          <div class="sr-only" aria-hidden="true">
            <label for="company" class="text-sm font-medium">Company</label>
            <input id="company" name="company" v-model="form.honeypot" type="text" tabindex="-1" autocomplete="off" />
          </div>

          <div class="space-y-2">
            <label for="name" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">Name</label>
            <input id="name" v-model="form.name" type="text" autocomplete="name" required
              class="block w-full rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/30" />
          </div>

          <div class="space-y-2">
            <label for="email" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">Email</label>
            <input id="email" v-model="form.email" type="email" inputmode="email" autocomplete="email" required
              class="block w-full rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/30" />
          </div>

          <div class="space-y-2">
            <label for="password" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Password
            </label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              minlength="6"
              required
              class="block w-full rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/30"
            />
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              Use at least 6 characters. You can reset it later from your dashboard.
            </p>
          </div>

          <div class="space-y-2">
            <label for="phone" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">Phone number
              (optional)</label>
            <input id="phone" v-model="form.phone" type="tel" inputmode="tel" autocomplete="tel"
              placeholder="e.g. +1 555 123 4567"
              class="block w-full rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/30" />
          </div>

          <div class="space-y-2">
            <label for="organization" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">Club or
              organization</label>
            <input id="organization" v-model="form.organization" type="text" placeholder="None"
              class="block w-full rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/30" />
          </div>

          <div class="space-y-2">
            <label for="role" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">Role</label>
            <select id="role" v-model="form.role" required
              class="block w-full appearance-none rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:focus:ring-neutral-100/30">
              <option disabled value="">Select a role</option>
              <option value="player">Player</option>
              <option value="coach">Coach</option>
              <option value="analyst">Analyst</option>
              <option value="referee">Referee</option>
              <option value="administrator">Administrator / Union Staff</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div class="space-y-2">
            <label for="usage" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">How do you plan to use
              Rugbycodex?</label>
            <textarea id="usage" v-model="form.usage" rows="3" placeholder="Share a short overview" required
              class="block w-full rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/30" />
          </div>

          <div class="space-y-2">
            <label for="referral" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">How did you hear
              about us?</label>
            <select id="referral" v-model="form.referral"
              class="block w-full appearance-none rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:focus:ring-neutral-100/30">
              <option value="">Select an option</option>
              <option value="referral">Friend or teammate</option>
              <option value="social">Social media</option>
              <option value="event">Conference or event</option>
              <option value="search">Search engine</option>
              <option value="community">Rugby community forum</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <!-- Cloudflare Turnstile -->
        <div v-if="shouldRenderTurnstile" class="mt-6 flex justify-around">
          <div ref="turnstileContainer" class="w-full max-w-sm"></div>
        </div>

        <p v-if="supabaseError" class="mt-6 text-sm text-rose-500 dark:text-rose-400">
          {{ supabaseError }}
        </p>

        <button type="submit"
          class="mt-10 inline-flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
          :disabled="signingUp || (shouldRenderTurnstile && !turnstileToken)">
          {{ signingUp ? 'Submitting…' : 'Request Invite' }}
        </button>
      </form>

      <div v-else
        class="rounded-3xl border border-emerald-300/60 bg-emerald-50/80 p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-emerald-800/60 dark:bg-emerald-900/40 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
        <div class="flex flex-col items-center gap-4">
          <Icon icon="solar:check-circle-bold-duotone" class="h-10 w-10 text-emerald-500" />
          <p class="text-lg font-medium text-emerald-800 dark:text-emerald-100">Access requested.</p>
          <p v-if="supabaseMessage" class="text-sm text-emerald-700 dark:text-emerald-200">
            {{ supabaseMessage }}
          </p>
          <p class="text-xs font-semibold text-red-500">*Be sure to check junk and spam folders!</p>
          <RouterLink to="/"
            class="text-sm font-medium text-emerald-700 underline-offset-4 transition hover:text-emerald-800 dark:text-emerald-200 dark:hover:text-emerald-100">
            Return home
          </RouterLink>
        </div>
      </div>

      <footer class="text-center text-sm text-neutral-500 dark:text-neutral-400">
        Already have access?
        <RouterLink to="/login"
          class="font-medium text-neutral-700 underline-offset-4 transition hover:text-neutral-900 dark:text-neutral-200 dark:hover:text-neutral-100">
          Log in instead
        </RouterLink>
      </footer>
    </div>
  </section>
</template>

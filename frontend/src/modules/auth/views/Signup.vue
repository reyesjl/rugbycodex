<script setup lang="ts">
import { reactive, ref, computed, watch, nextTick } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import TurnstileVerification from '@/components/TurnstileVerification.vue';
import bgImg from '@/assets/modules/auth/headingley.jpg';
import { useStaggeredFade } from '@/composables/useStaggeredFade';
const authStore = useAuthStore();
const router = useRouter();
const signingUp = ref(false);
const supabaseError = ref<string | null>(null);
const supabaseMessage = ref<string | null>(null);
const confirmationRedirectUrl =
  typeof window !== 'undefined' ? `${window.location.origin}/confirm-email` : undefined;
const turnstileToken = ref('');
const turnstileRequired = ref(false);
const { register: registerFadeItem } = useStaggeredFade();
import AuthNav from '../components/AuthNav.vue';

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  organization: '',
  role: '',
  usage: '',
  referral: '',
  honeypot: '',
});

const submissionLogged = ref(false);
const passwordMismatch = computed(
  () => Boolean(form.password) && Boolean(form.confirmPassword) && form.password !== form.confirmPassword,
);
const showPasswordMismatch = computed(() => Boolean(form.confirmPassword?.trim()) && passwordMismatch.value);

watch(
  () => [form.password, form.confirmPassword],
  () => {
    if (supabaseError.value === 'Passwords do not match.' && !passwordMismatch.value) {
      supabaseError.value = null;
    }
  },
);

const handleSubmit = async () => {
  if (turnstileRequired.value && !turnstileToken.value) {
    console.warn('turnstile verification is required before submitting');
    return;
  }

  if (form.honeypot?.trim()) {
    console.warn('beta access request flagged as spam', { ...form });
    return;
  }

  if (passwordMismatch.value) {
    supabaseError.value = 'Passwords do not match.';
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

  const { data, error } = await authStore.signUp(
    form.email,
    form.password,
    metadata,
    confirmationRedirectUrl,
    turnstileRequired.value ? turnstileToken.value : undefined,
  );

  if (error) {
    supabaseError.value = error.message ?? 'Something went wrong while creating your account.';
    signingUp.value = false;
    return;
  }

  if (data?.session) {
    supabaseMessage.value = 'Your account is ready. We will redirect you to the dashboard.';
    submissionLogged.value = true;
    await nextTick();
    await router.push({ name: 'DashboardOverview' });
    signingUp.value = false;
    return;
  }

  supabaseMessage.value =
    'Check your inbox to confirm your email. Once verified, you can sign in to your dashboard.';
  submissionLogged.value = true;
  signingUp.value = false;
};
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
      
      <div class="flex items-center min-h-screen py-20">
        <div class="w-full">
          <div class="space-y-5">
            <h1 class="text-5xl md:text-8xl text-white" :ref="registerFadeItem">Welcome.</h1>
          </div>

          <form v-if="!submissionLogged" @submit.prevent="handleSubmit" class="mt-10">
            <div class="space-y-10">
              <div class="sr-only" aria-hidden="true">
                <label for="signup-company" class="text-xs">Company</label>
                <input
                  id="signup-company"
                  v-model="form.honeypot"
                  type="text"
                  name="company"
                  tabindex="-1"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  inputmode="text"
                />
              </div>

              <div class="flex flex-col space-y-2" :ref="registerFadeItem">
                <label for="name" class="text-xs uppercase text-white">Name</label>
                <input id="name" v-model="form.name" type="text" autocomplete="name" placeholder="displayname" required
                  class="block w-full backdrop-blur bg-black/10 text-white border-b-2 border-white placeholder-white/30 px-2 py-1 outline-none" />
              </div>

              <div class="flex flex-col space-y-2" :ref="registerFadeItem">
                <label for="email" class="text-xs uppercase text-white">Email</label>
                <input id="email" v-model="form.email" type="email" inputmode="email" autocomplete="email" placeholder="user@rugbycodex.com" required
                  class="block w-full backdrop-blur bg-black/10 text-white border-b-2 border-white placeholder-white/30 px-2 py-1 outline-none" />
              </div>

              <div class="flex flex-col space-y-2" :ref="registerFadeItem">
                <label for="password" class="text-xs uppercase text-white">Password</label>
                <input id="password" v-model="form.password" type="password" autocomplete="new-password" minlength="6"
                  required
                  class="block w-full backdrop-blur bg-black/10 text-white border-b-2 border-white placeholder-white/30 px-2 py-1 outline-none" />
                <p class="text-xs text-white/70">
                  Use at least 6 characters. You can reset it later from your dashboard.
                </p>
              </div>

              <div class="flex flex-col space-y-2" :ref="registerFadeItem">
                <label for="confirm-password" class="text-xs uppercase text-white">Confirm password</label>
                <input id="confirm-password" v-model="form.confirmPassword" type="password" autocomplete="new-password"
                  minlength="6" required
                  class="block w-full backdrop-blur bg-black/10 text-white border-b-2 border-white placeholder-white/30 px-2 py-1 outline-none" />
                <p v-if="showPasswordMismatch" class="text-sm text-rose-400">Passwords do not match.</p>
              </div>

              <div class="flex flex-col space-y-2" :ref="registerFadeItem">
                <label for="phone" class="text-xs uppercase text-white">Phone number (optional)</label>
                <input id="phone" v-model="form.phone" type="tel" inputmode="tel" autocomplete="tel"
                  placeholder="e.g. +1 555 123 4567"
                  class="block w-full backdrop-blur bg-black/10 text-white border-b-2 border-white placeholder-white/30 px-2 py-1 outline-none" />
              </div>

              <div class="flex flex-col space-y-2" :ref="registerFadeItem">
                <label for="organization" class="text-xs uppercase text-white">Club or organization</label>
                <input id="organization" v-model="form.organization" type="text" placeholder="None"
                  class="block w-full backdrop-blur bg-black/10 text-white border-b-2 border-white placeholder-white/30 px-2 py-1 outline-none" />
              </div>

              <div class="flex flex-col space-y-2" :ref="registerFadeItem">
                <label for="role" class="text-xs uppercase text-white">Role</label>
                <select id="role" v-model="form.role" required
                  class="block w-full backdrop-blur bg-black/10 text-white border-b-2 border-white px-2 py-1 outline-none">
                  <option disabled value="">Select a role</option>
                  <option value="player">Player</option>
                  <option value="coach">Coach</option>
                  <option value="analyst">Analyst</option>
                  <option value="referee">Referee</option>
                  <option value="administrator">Administrator / Union Staff</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div class="flex flex-col space-y-2" :ref="registerFadeItem">
                <label for="usage" class="text-xs uppercase text-white">How do you plan to use Rugbycodex?</label>
                <textarea id="usage" v-model="form.usage" rows="3" placeholder="Share a short overview" required
                  class="block w-full backdrop-blur bg-black/10 text-white border-b-2 border-white placeholder-white/30 px-2 py-1 outline-none"></textarea>
              </div>

              <div class="flex flex-col space-y-2" :ref="registerFadeItem">
                <label for="referral" class="text-xs uppercase text-white">How did you hear about us?</label>
                <select id="referral" v-model="form.referral"
                  class="block w-full backdrop-blur bg-black/10 text-white border-b-2 border-white px-2 py-1 outline-none">
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

            <div class="mt-6" :ref="registerFadeItem">
              <TurnstileVerification
                v-model:token="turnstileToken"
                v-model:required="turnstileRequired"
              />
            </div>

            <p v-if="supabaseError" class="mt-6 text-sm text-rose-400">
              {{ supabaseError }}
            </p>

            <button type="submit" :ref="registerFadeItem"
              class="mt-10 inline-flex w-full items-center justify-center rounded-xs bg-white px-4 py-3 text-sm uppercase tracking-[0.2em] text-black"
              :disabled="signingUp || passwordMismatch || (turnstileRequired && !turnstileToken)">
              {{ signingUp ? 'Submitting…' : !turnstileToken ? 'Verifying…' : 'Sign Up' }}
            </button>
          </form>

          <div v-else
            class="mt-10 rounded-xs border border-white/40 bg-white/10 p-8 text-center text-white backdrop-blur">
            <div class="flex flex-col items-center gap-4">
              <Icon icon="solar:check-circle-bold-duotone" class="h-10 w-10 text-emerald-300" />
              <p class="text-lg font-medium">Access requested.</p>
              <p v-if="supabaseMessage" class="text-sm text-white/80">
                {{ supabaseMessage }}
              </p>
              <p class="text-xs font-semibold text-rose-200">*Be sure to check junk and spam folders!</p>
              <RouterLink to="/"
                class="text-sm font-medium underline underline-offset-4 text-white">
                Return home
              </RouterLink>
            </div>
          </div>

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

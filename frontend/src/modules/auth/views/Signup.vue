<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { profileService } from '@/modules/profiles/services/profileServiceV2';
import TurnstileVerification from '@/components/TurnstileVerification.vue';

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

const authStore = useAuthStore();
const router = useRouter();

const signingUp = ref(false);
const supabaseError = ref<string | null>(null);
const supabaseMessage = ref<string | null>(null);
const submissionLogged = ref(false);

const confirmationRedirectUrl =
  typeof window !== 'undefined' ? `${window.location.origin}/auth/confirm-email` : undefined;

const turnstileToken = ref('');
const turnstileRequired = ref(false);
const turnstileRef = ref<InstanceType<typeof TurnstileVerification> | null>(null);

const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 24;

const form = reactive({
  username: '',
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

const referralOptions: SelectOption[] = [
  { value: '', label: 'Select an option', disabled: true },
  { value: 'referral', label: 'Friend or teammate' },
  { value: 'social', label: 'Social media' },
  { value: 'event', label: 'Conference or event' },
  { value: 'search', label: 'Search engine' },
  { value: 'community', label: 'Rugby community forum' },
  { value: 'other', label: 'Other' },
];

const roleOptions: SelectOption[] = [
  { value: '', label: 'Select a role', disabled: true },
  { value: 'player', label: 'Player' },
  { value: 'coach', label: 'Coach' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'referee', label: 'Referee' },
  { value: 'administrator', label: 'Administrator / Union Staff' },
  { value: 'other', label: 'Other' },
];

const selectedRoleOption = ref<SelectOption>(roleOptions[0]!);
const selectedReferralOption = ref<SelectOption>(referralOptions[0]!);

watch(selectedRoleOption, (opt) => {
  form.role = opt.value;
});

watch(selectedReferralOption, (opt) => {
  form.referral = opt.value;
});

const passwordMismatch = computed(
  () => Boolean(form.password) && Boolean(form.confirmPassword) && form.password !== form.confirmPassword,
);
const showPasswordMismatch = computed(() => Boolean(form.confirmPassword?.trim()) && passwordMismatch.value);

const usernameStatus = reactive({
  checking: false,
  available: false,
  message: '',
  dirty: false,
});
const usernameCheckToken = ref(0);
let usernameCheckTimeout: ReturnType<typeof setTimeout> | null = null;

watch(
  () => [form.password, form.confirmPassword],
  () => {
    if (supabaseError.value === 'Passwords do not match.' && !passwordMismatch.value) {
      supabaseError.value = null;
    }
  },
);

const normalizedUsername = computed(() => form.username.trim().toLowerCase());
const usernamePatternValid = computed(() => {
  const value = normalizedUsername.value;
  if (!value) return false;
  return (
    value.length >= USERNAME_MIN_LENGTH &&
    value.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(value)
  );
});

watch(
  () => normalizedUsername.value,
  (next) => {
    usernameStatus.dirty = Boolean(next);
    usernameStatus.available = false;
    usernameStatus.message = '';

    if (!next) {
      usernameStatus.checking = false;
      usernameCheckToken.value++;
      if (usernameCheckTimeout) {
        clearTimeout(usernameCheckTimeout);
        usernameCheckTimeout = null;
      }
      return;
    }

    if (!usernamePatternValid.value) {
      usernameStatus.checking = false;
      usernameStatus.message = `Use ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} lowercase letters, numbers, dots, underscores, or hyphens.`;
      return;
    }

    const token = ++usernameCheckToken.value;
    usernameStatus.checking = true;
    if (usernameCheckTimeout) {
      clearTimeout(usernameCheckTimeout);
    }
    usernameCheckTimeout = setTimeout(async () => {
      try {
        const available = await profileService.isUsernameAvailable(next);
        if (token !== usernameCheckToken.value) return;
        usernameStatus.available = available;
        usernameStatus.message = available
          ? 'Username is available.'
          : 'That username is already taken.';
      } catch (error) {
        if (token !== usernameCheckToken.value) return;
        console.error('Failed to verify username availability', error);
        usernameStatus.message = 'Unable to verify availability.';
        usernameStatus.available = false;
      } finally {
        if (token === usernameCheckToken.value) {
          usernameStatus.checking = false;
        }
        usernameCheckTimeout = null;
      }
    }, 400);
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

  if (!normalizedUsername.value) {
    supabaseError.value = 'Username is required.';
    signingUp.value = false;
    return;
  }

  if (!usernamePatternValid.value) {
    supabaseError.value = `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters and use lowercase letters, numbers, dots, underscores, or hyphens.`;
    signingUp.value = false;
    return;
  }

  try {
    const available = await profileService.isUsernameAvailable(normalizedUsername.value);
    usernameStatus.available = available;
    usernameStatus.message = available
      ? 'Username is available.'
      : 'That username is already taken.';
    if (!available) {
      supabaseError.value = 'That username is already taken. Please choose another.';
      signingUp.value = false;
      return;
    }
  } catch (error) {
    console.error('Failed to verify username availability', error);
    supabaseError.value = 'Unable to verify username availability. Please try again.';
    signingUp.value = false;
    return;
  }

  const metadata = {
    username: normalizedUsername.value,
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
    turnstileRef.value?.reset();
    signingUp.value = false;
    return;
  }

  if (data?.session) {
    supabaseMessage.value = 'Your account is ready. Redirecting you to your home...';
    submissionLogged.value = true;
    await nextTick();
    // Behavior change: landing now resolves to onboarding or My Rugby.
    await router.push({ name: 'Dashboard' });
    signingUp.value = false;
    return;
  }

  supabaseMessage.value =
    'Check your inbox to confirm your email. Once verified, you can sign in to your home.';
  submissionLogged.value = true;
  signingUp.value = false;
};

const inputClass =
  'block w-full border-b border-neutral-600 bg-transparent py-2 text-sm text-white placeholder:text-neutral-500 focus:border-white focus:outline-none';
const selectClass = `${inputClass} pr-8 bg-neutral-900`;
const textareaClass = `${inputClass} min-h-[96px]`;
</script>

<template>
  <div class="space-y-8">
    <header class="space-y-2 text-center">
      <h1 class="text-xl font-semibold uppercase tracking-[0.3em] text-white">SYSTEM ACCESS</h1>
      <p class="text-sm text-neutral-400">Access to the Rugbycodex platform.</p>
    </header>

    <form v-if="!submissionLogged" @submit.prevent="handleSubmit" class="space-y-8">
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

      <div class="space-y-4">
        <div class="text-[10px] font-semibold uppercase tracking-[0.35em] text-blue-400">Identity</div>
        <div class="space-y-4">
          <div class="space-y-1">
            <label for="name" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Name
            </label>
            <input id="name" v-model="form.name" type="text" autocomplete="name" required :class="inputClass" />
          </div>

          <div class="space-y-1">
            <label for="username" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Username
            </label>
            <input id="username" v-model="form.username" type="text" autocomplete="username" required :class="inputClass" />
            <p class="text-[11px] text-neutral-500">
              {{ USERNAME_MIN_LENGTH }}-{{ USERNAME_MAX_LENGTH }} lowercase letters, numbers, dots, underscores, or
              hyphens.
            </p>
            <p
              v-if="usernameStatus.message || usernameStatus.checking"
              class="text-[11px]"
              :class="usernameStatus.available ? 'text-emerald-400' : 'text-rose-400'"
            >
              <span v-if="usernameStatus.checking">Checking availability...</span>
              <span v-else>{{ usernameStatus.message }}</span>
            </p>
          </div>
        </div>
      </div>

      <div class="space-y-4 pt-6">
        <div class="text-[10px] font-semibold uppercase tracking-[0.35em] text-blue-400">Access</div>
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
              :class="inputClass"
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
              autocomplete="new-password"
              minlength="6"
              required
              :class="inputClass"
            />
          </div>

          <div class="space-y-1">
            <label for="confirm-password" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Confirm password
            </label>
            <input
              id="confirm-password"
              v-model="form.confirmPassword"
              type="password"
              autocomplete="new-password"
              minlength="6"
              required
              :class="inputClass"
            />
            <p v-if="showPasswordMismatch" class="text-[11px] text-rose-400">
              Passwords do not match.
            </p>
          </div>
        </div>
      </div>

      <div class="space-y-4 pt-6">
        <div class="text-[10px] font-semibold uppercase tracking-[0.35em] text-blue-400">Context</div>
        <div class="space-y-4">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Role
            </label>
            <Listbox v-model="selectedRoleOption" required>
              <div class="relative">
                <ListboxButton :class="[selectClass, 'relative w-full cursor-pointer text-left pr-10', selectedRoleOption.value ? 'text-white' : 'text-neutral-500']">
                  <span class="block truncate">{{ selectedRoleOption.label }}</span>
                  <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
                  </span>
                </ListboxButton>
                
                <transition
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="opacity-100"
                  leave-to-class="opacity-0"
                >
                  <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 text-sm shadow-lg focus:outline-none">
                    <ListboxOption
                      v-for="opt in roleOptions.filter(o => !o.disabled)"
                      :key="opt.value"
                      :value="opt"
                      as="template"
                      v-slot="{ active, selected }"
                    >
                      <li
                        class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                        :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                      >
                        <span :class="selected ? 'font-semibold' : 'font-normal'" class="block truncate">
                          {{ opt.label }}
                        </span>
                        <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                          <Icon icon="carbon:checkmark" class="h-4 w-4" />
                        </span>
                      </li>
                    </ListboxOption>
                  </ListboxOptions>
                </transition>
              </div>
            </Listbox>
          </div>

          <div class="space-y-1">
            <label for="organization" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Club or organization
            </label>
            <input id="organization" v-model="form.organization" type="text" :class="inputClass" />
          </div>

          <div class="space-y-1">
            <label class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              How did you hear about us?
            </label>
            <Listbox v-model="selectedReferralOption">
              <div class="relative">
                <ListboxButton :class="[selectClass, 'relative w-full cursor-pointer text-left pr-10', selectedReferralOption.value ? 'text-white' : 'text-neutral-500']">
                  <span class="block truncate">{{ selectedReferralOption.label }}</span>
                  <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
                  </span>
                </ListboxButton>
                
                <transition
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="opacity-100"
                  leave-to-class="opacity-0"
                >
                  <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 text-sm shadow-lg focus:outline-none">
                    <ListboxOption
                      v-for="opt in referralOptions.filter(o => !o.disabled)"
                      :key="opt.value"
                      :value="opt"
                      as="template"
                      v-slot="{ active, selected }"
                    >
                      <li
                        class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                        :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                      >
                        <span :class="selected ? 'font-semibold' : 'font-normal'" class="block truncate">
                          {{ opt.label }}
                        </span>
                        <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                          <Icon icon="carbon:checkmark" class="h-4 w-4" />
                        </span>
                      </li>
                    </ListboxOption>
                  </ListboxOptions>
                </transition>
              </div>
            </Listbox>
          </div>
        </div>
      </div>

      <div class="space-y-4 pt-6">
        <div class="text-[10px] font-semibold uppercase tracking-[0.35em] text-blue-400">Optional</div>
        <div class="space-y-4">
          <div class="space-y-1">
            <label for="phone" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Phone number
            </label>
            <input id="phone" v-model="form.phone" type="tel" inputmode="tel" autocomplete="tel" :class="inputClass" />
          </div>

          <div class="space-y-1">
            <label for="usage" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              How do you plan to use RugbyCodex?
            </label>
            <textarea id="usage" v-model="form.usage" rows="3" required :class="textareaClass"></textarea>
          </div>
        </div>
      </div>

      <TurnstileVerification
        class="mt-2 opacity-70"
        v-model:token="turnstileToken"
        v-model:required="turnstileRequired"
        ref="turnstileRef"
      />

      <p v-if="supabaseError" class="text-xs text-rose-400">
        {{ supabaseError }}
      </p>

      <button
        type="submit"
        class="inline-flex w-full items-center justify-center bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="signingUp || passwordMismatch || (turnstileRequired && !turnstileToken)"
      >
        {{ signingUp ? 'Submitting...' : 'Commit request' }}
      </button>
    </form>

    <div v-else class="space-y-4">
      <p class="text-base font-semibold text-white">Request recorded.</p>
      <p v-if="supabaseMessage" class="text-sm text-neutral-400">
        {{ supabaseMessage }}
      </p>
      <p class="text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-400">
        Check spam and junk folders.
      </p>
      <RouterLink
        to="/auth/login"
        class="inline-flex w-full items-center justify-center bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:opacity-90"
      >
        Back to login
      </RouterLink>
    </div>

    <footer class="pt-4 text-xs text-neutral-500">
      Already have access?
      <RouterLink to="/auth/login" class="ml-1 font-semibold uppercase tracking-[0.2em] text-white">
        Sign in
      </RouterLink>
    </footer>
  </div>
</template>

<style scoped>
.dark-select option {
  background-color: #0a0a0a;
  color: #ffffff;
}
</style>

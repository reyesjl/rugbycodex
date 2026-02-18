<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import TurnstileVerification from '@/components/TurnstileVerification.vue';
import { supabase } from '@/lib/supabaseClient';
import { invokeEdge } from '@/lib/api';
import { handleEdgeFunctionError } from '@/lib/handleEdgeFunctionError';

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

const signingUp = ref(false);
const supabaseError = ref<string | null>(null);
const supabaseMessage = ref<string | null>(null);
const submissionLogged = ref(false);

const turnstileToken = ref('');
const turnstileRequired = ref(false);
const turnstileRef = ref<InstanceType<typeof TurnstileVerification> | null>(null);
const isSubmitDisabled = computed(
  () => signingUp.value || (turnstileRequired.value && !turnstileToken.value),
);

const form = reactive({
  email: '',
  firstName: '',
  role: '',
  primaryProblem: '',
  urgency: '',
  earlyAccessPayment: '',
  honeypot: '',
});

const roleOptions: SelectOption[] = [
  { value: '', label: 'Select a role', disabled: true },
  { value: 'union', label: 'Union' },
  { value: 'team', label: 'Team' },
  { value: 'coach', label: 'Coach' },
  { value: 'player', label: 'Player' },
];

const urgencyOptions: SelectOption[] = [
  { value: '', label: 'Select urgency', disabled: true },
  { value: 'exploring', label: 'Exploring options' },
  { value: '3_months', label: 'Within 3 months' },
  { value: 'asap', label: 'ASAP' },
];

const paymentOptions: SelectOption[] = [
  { value: '', label: 'Select an option', disabled: true },
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_now', label: 'Not right now' },
];

const selectedRoleOption = ref<SelectOption>(roleOptions[0]!);
const selectedUrgencyOption = ref<SelectOption>(urgencyOptions[0]!);
const selectedPaymentOption = ref<SelectOption>(paymentOptions[0]!);

watch(selectedRoleOption, (opt) => {
  form.role = opt.value;
});

watch(selectedUrgencyOption, (opt) => {
  form.urgency = opt.value;
});

watch(selectedPaymentOption, (opt) => {
  form.earlyAccessPayment = opt.value;
});

const isEmailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const handleSubmit = async () => {
  if (turnstileRequired.value && !turnstileToken.value) {
    supabaseError.value = 'Please complete the verification challenge.';
    return;
  }

  if (form.honeypot?.trim()) {
    console.warn('waitlist request flagged as spam', { ...form });
    return;
  }

  if (!isEmailValid(form.email)) {
    supabaseError.value = 'Please provide a valid email address.';
    return;
  }

  if (!form.firstName.trim() || !form.role || !form.primaryProblem.trim() || !form.urgency || !form.earlyAccessPayment) {
    supabaseError.value = 'Please complete all required fields.';
    return;
  }

  signingUp.value = true;
  supabaseError.value = null;
  supabaseMessage.value = null;

  const payload = {
    email: form.email.trim().toLowerCase(),
    first_name: form.firstName.trim(),
    role: form.role,
    primary_problem: form.primaryProblem.trim(),
    urgency: form.urgency,
    early_access_payment: form.earlyAccessPayment,
  };

  const { error } = await supabase.from('waitlist').insert(payload);

  if (error) {
    if (error.code === '23505') {
      supabaseError.value = "This email is already on the waitlist. We'll be in touch soon.";
    } else {
      supabaseError.value = error.message ?? 'Something went wrong while joining the waitlist.';
    }
    turnstileRef.value?.reset();
    signingUp.value = false;
    return;
  }

  try {
    const response = await invokeEdge('waitlist-confirmation', { body: payload });
    if (response.error) {
      throw await handleEdgeFunctionError(response.error, 'Waitlist saved, but confirmation email failed.');
    }
  } catch (invokeError) {
    const message = invokeError instanceof Error ? invokeError.message : 'Waitlist saved, but confirmation email failed.';
    console.error('Failed to send waitlist confirmation email', invokeError);
    supabaseMessage.value = message;
  }

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
      <h1 class="text-xl font-semibold uppercase tracking-[0.3em] text-white">Join the Waitlist</h1>
      <p class="text-sm text-neutral-400">
        We're onboarding a small number of pilot teams as part of our launch. Join the waitlist to be considered
        for early access.
      </p>
    </header>

    <form v-if="!submissionLogged" @submit.prevent="handleSubmit" class="space-y-8">
      <div class="sr-only" aria-hidden="true">
        <label for="waitlist-company" class="text-xs">Company</label>
        <input
          id="waitlist-company"
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
            <label for="first-name" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              First name
            </label>
            <input id="first-name" v-model="form.firstName" type="text" autocomplete="given-name" required :class="inputClass" />
          </div>

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
            <label for="primary-problem" class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Primary problem
            </label>
            <textarea
              id="primary-problem"
              v-model="form.primaryProblem"
              rows="3"
              placeholder="Whats the biggest problem you face in your rugby life / workflow?"
              required
              :class="textareaClass"
            ></textarea>
          </div>
        </div>
      </div>

      <div class="space-y-4 pt-6">
        <div class="text-[10px] font-semibold uppercase tracking-[0.35em] text-blue-400">Timing</div>
        <div class="space-y-4">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Urgency
            </label>
            <Listbox v-model="selectedUrgencyOption" required>
              <div class="relative">
                <ListboxButton :class="[selectClass, 'relative w-full cursor-pointer text-left pr-10', selectedUrgencyOption.value ? 'text-white' : 'text-neutral-500']">
                  <span class="block truncate">{{ selectedUrgencyOption.label }}</span>
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
                      v-for="opt in urgencyOptions.filter(o => !o.disabled)"
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
            <label class="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Would you pay for early access?
            </label>
            <Listbox v-model="selectedPaymentOption" required>
              <div class="relative">
                <ListboxButton :class="[selectClass, 'relative w-full cursor-pointer text-left pr-10', selectedPaymentOption.value ? 'text-white' : 'text-neutral-500']">
                  <span class="block truncate">{{ selectedPaymentOption.label }}</span>
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
                      v-for="opt in paymentOptions.filter(o => !o.disabled)"
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

      <TurnstileVerification
        class="mt-2 opacity-70"
        v-model:token="turnstileToken"
        v-model:required="turnstileRequired"
        ref="turnstileRef"
      />

      <p v-if="supabaseError" class="text-xs text-rose-400">
        {{ supabaseError }}
      </p>

      <span class="auth-submit-shell">
        <button
          type="submit"
          class="inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.35em] text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-black disabled:text-white disabled:opacity-100"
          :disabled="isSubmitDisabled"
        >
          <Icon v-if="isSubmitDisabled" icon="line-md:loading-loop" class="mr-2 h-4 w-4" />
          {{ signingUp ? 'Submitting...' : 'Join waitlist' }}
        </button>
      </span>
    </form>

    <div v-else class="space-y-4">
      <p class="text-base font-semibold text-white">You're on the list. We'll reach out soon.</p>
      <p v-if="supabaseMessage" class="text-sm text-neutral-400">
        {{ supabaseMessage }}
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

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_MIN_LENGTH, useAuthStore } from '@/auth/stores/useAuthStore';

const authStore = useAuthStore();
const router = useRouter();
const displayName = ref('');
const saving = ref(false);
const successMessage = ref('');
const errorMessage = ref<string | null>(null);
const loggingOut = ref(false);
const logoutError = ref<string | null>(null);

const syncFromStore = () => {
  const metadataName = authStore.user?.user_metadata?.name as string | undefined;
  displayName.value = metadataName ?? '';
};

onMounted(() => {
  syncFromStore();
});

watch(
  () => authStore.user?.user_metadata?.name,
  () => {
    if (!saving.value) {
      syncFromStore();
    }
  },
);

const trimmedDisplayName = computed(() => displayName.value.trim());
const trimmedLength = computed(() => trimmedDisplayName.value.length);

const lengthWarning = computed(() => {
  if (!trimmedLength.value) return '';
  if (trimmedLength.value < DISPLAY_NAME_MIN_LENGTH) {
    return `Display name must be at least ${DISPLAY_NAME_MIN_LENGTH} characters.`;
  }
  if (trimmedLength.value > DISPLAY_NAME_MAX_LENGTH) {
    return `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters.`;
  }
  return '';
});

const isDirty = computed(() => {
  const current = (authStore.user?.user_metadata?.name as string | undefined)?.trim() ?? '';
  return trimmedDisplayName.value !== current;
});

const canSubmit = computed(() => {
  return (
    !saving.value &&
    isDirty.value &&
    trimmedLength.value >= DISPLAY_NAME_MIN_LENGTH &&
    trimmedLength.value <= DISPLAY_NAME_MAX_LENGTH
  );
});

const handleSubmit = async () => {
  if (!canSubmit.value) {
    if (!isDirty.value) {
      successMessage.value = 'Display name is already up to date.';
    }
    return;
  }

  saving.value = true;
  successMessage.value = '';
  errorMessage.value = null;

  const { error } = await authStore.updateDisplayName(displayName.value);

  saving.value = false;

  if (error) {
    errorMessage.value = error.message ?? 'Unable to update display name.';
    return;
  }

  successMessage.value = 'Display name updated successfully.';
};

const handleLogout = async () => {
  if (loggingOut.value) return;
  loggingOut.value = true;
  logoutError.value = null;
  const { error } = await authStore.signOut();
  loggingOut.value = false;

  if (error) {
    logoutError.value = error.message ?? 'Unable to sign out right now.';
    return;
  }

  router.push('/v2/auth/login');
};
</script>

<template>
  <section class="container-lg space-y-6">
    <article
      class="rounded-3xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
          Account Settings
        </p>
        <h2 class="mt-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Personalize your profile
        </h2>
      </div>

      <form class="mt-6 space-y-6" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <label for="display-name" class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
            Display name
          </label>
          <input id="display-name" v-model="displayName" type="text" :maxlength="DISPLAY_NAME_MAX_LENGTH"
            class="block w-full rounded-2xl border border-neutral-200/70 bg-white/80 px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/30 dark:border-neutral-700/70 dark:bg-neutral-900/60 dark:text-neutral-50 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-100/30"
            placeholder="Enter your preferred name" autocomplete="name" />
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ trimmedLength }} characters &middot; keep between {{ DISPLAY_NAME_MIN_LENGTH }} and
            {{ DISPLAY_NAME_MAX_LENGTH }} characters.
          </p>
          <p v-if="lengthWarning" class="text-sm text-rose-500 dark:text-rose-400">
            {{ lengthWarning }}
          </p>
        </div>

        <div class="space-y-3">
          <button type="submit"
            class="inline-flex items-center justify-center rounded-2xl bg-neutral-900 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
            :disabled="!canSubmit">
            <span v-if="saving"
              class="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-neutral-200 border-t-transparent dark:border-neutral-700"></span>
            <span>{{ saving ? 'Saving…' : 'Save changes' }}</span>
          </button>

          <p v-if="errorMessage" class="text-sm text-rose-500 dark:text-rose-400">
            {{ errorMessage }}
          </p>
          <p v-if="successMessage" class="text-sm text-emerald-600 dark:text-emerald-400">
            {{ successMessage }}
          </p>
        </div>
      </form>

      <div class="mt-10 rounded-2xl border border-neutral-200/70 bg-white/70 p-4 text-center dark:border-neutral-800/70 dark:bg-neutral-900/60">
        <p class="text-sm text-neutral-600 dark:text-neutral-300">Need to switch accounts?</p>
        <button
          type="button"
          class="mt-3 inline-flex items-center justify-center rounded-2xl border border-rose-300/60 px-5 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-rose-600 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/50 dark:text-rose-200"
          @click="handleLogout"
          :disabled="loggingOut"
        >
          <span v-if="loggingOut" class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-rose-200 border-t-transparent dark:border-rose-300"></span>
          <span>{{ loggingOut ? 'Signing out…' : 'Sign out' }}</span>
        </button>
        <p v-if="logoutError" class="mt-2 text-sm text-rose-500 dark:text-rose-300">{{ logoutError }}</p>
      </div>
    </article>
  </section>
</template>


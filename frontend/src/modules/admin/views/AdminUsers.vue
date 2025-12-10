<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import RefreshButton from '@/components/RefreshButton.vue';
import BatchActionBar, { type BatchAction } from '@/components/ui/tables/BatchActionBar.vue';
import { useProfilesList } from '@/modules/profiles/composables/useProfileList';
import type { UserProfile } from '@/modules/profiles/types';

const profileList = useProfilesList();
const searchQuery = ref('');
const selectedProfileIds = ref<string[]>([]);
const disabledProfileMap = ref<Record<string, boolean>>({});
const isBatchProcessing = ref(false);
const showMessageModal = ref(false);
const messageBody = ref('');
const messageError = ref<string | null>(null);
const canSendMessage = computed(() => Boolean(messageBody.value.trim()) && !isBatchProcessing.value);
const copyStatus = ref<Record<string, 'idle' | 'copied' | 'error'>>({});
const copyResetTimers = new Map<string, number>();

const formatDate = (date?: Date | null) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const handleRefresh = async () => {
  await profileList.loadProfiles();
};

const filteredProfiles = computed<UserProfile[]>(() => {
  const source = [...profileList.profiles.value];
  if (!searchQuery.value.trim()) {
    return source;
  }
  const query = searchQuery.value.toLowerCase();
  return source.filter((profile) => {
    const username = profile.username?.toLowerCase() ?? '';
    const display = profile.name?.toLowerCase() ?? '';
    const id = profile.id.toLowerCase();
    return username.includes(query) || display.includes(query) || id.includes(query);
  });
});

const isProfileDisabled = (profileId: string) => Boolean(disabledProfileMap.value[profileId]);
const isProfileSelected = (profileId: string) => selectedProfileIds.value.includes(profileId);

const selectableProfiles = computed(() => filteredProfiles.value.filter((profile) => !isProfileDisabled(profile.id)));
const allSelectableSelected = computed(
  () => selectableProfiles.value.length > 0 && selectableProfiles.value.every((profile) => isProfileSelected(profile.id))
);
const selectionCount = computed(() => selectedProfileIds.value.length);

const toggleProfileSelection = (profileId: string) => {
  if (isProfileDisabled(profileId)) return;
  if (isProfileSelected(profileId)) {
    selectedProfileIds.value = selectedProfileIds.value.filter((id) => id !== profileId);
  } else {
    selectedProfileIds.value = [...selectedProfileIds.value, profileId];
  }
};

const handleSelectAll = (checked: boolean) => {
  if (checked) {
    selectedProfileIds.value = selectableProfiles.value.map((profile) => profile.id);
  } else {
    selectedProfileIds.value = [];
  }
};

const handleSelectAllChange = (event: globalThis.Event) => {
  const target = event.target as globalThis.HTMLInputElement | null;
  handleSelectAll(Boolean(target?.checked));
};

const clearProfileSelection = () => {
  selectedProfileIds.value = [];
};

const toggleProfileDisable = (profileId: string) => {
  const nextState = !isProfileDisabled(profileId);
  disabledProfileMap.value = { ...disabledProfileMap.value, [profileId]: nextState };
  if (nextState) {
    selectedProfileIds.value = selectedProfileIds.value.filter((id) => id !== profileId);
  }
};

const updateCopyStatus = (profileId: string, status: 'idle' | 'copied' | 'error') => {
  copyStatus.value = { ...copyStatus.value, [profileId]: status };
  if (typeof window === 'undefined') return;
  if (status === 'idle') {
    const timer = copyResetTimers.get(profileId);
    if (timer) {
      window.clearTimeout(timer);
      copyResetTimers.delete(profileId);
    }
    return;
  }
  const duration = status === 'copied' ? 1800 : 3000;
  const existing = copyResetTimers.get(profileId);
  if (existing) {
    window.clearTimeout(existing);
  }
  const timer = window.setTimeout(() => {
    copyResetTimers.delete(profileId);
    copyStatus.value = { ...copyStatus.value, [profileId]: 'idle' };
  }, duration);
  copyResetTimers.set(profileId, timer);
};

const copyProfileIdToClipboard = async (profileId: string) => {
  const text = profileId;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    } else {
      throw new Error('Clipboard API is not available in this environment.');
    }
    updateCopyStatus(profileId, 'copied');
    console.info('Copied profile ID to clipboard:', profileId);
  } catch (error) {
    console.error('Unable to copy profile ID', error);
    updateCopyStatus(profileId, 'error');
  }
};

const copyLabel = (profileId: string) => {
  const state = copyStatus.value[profileId];
  if (state === 'copied') return 'Copied';
  if (state === 'error') return 'Retry copy';
  return 'Copy ID';
};

const handleInviteProfile = () => {
  console.info('Invite profile action triggered');
};

const openMessageModal = () => {
  if (!selectedProfileIds.value.length) return;
  messageBody.value = '';
  messageError.value = null;
  showMessageModal.value = true;
};

const closeMessageModal = () => {
  if (isBatchProcessing.value) return;
  showMessageModal.value = false;
  messageBody.value = '';
  messageError.value = null;
};

const handleBatchMessage = () => {
  openMessageModal();
};

const handleSendMessage = async () => {
  if (!messageBody.value.trim()) {
    messageError.value = 'Enter a message before sending.';
    return;
  }
  isBatchProcessing.value = true;
  messageError.value = null;
  try {
    console.info('Message profiles:', {
      profileIds: selectedProfileIds.value,
      message: messageBody.value.trim(),
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
    closeMessageModal();
  } finally {
    isBatchProcessing.value = false;
  }
};

const profileBatchActions = computed<BatchAction[]>(() => [
  {
    id: 'message',
    label: 'Message',
    icon: 'mdi:email-outline',
    variant: 'primary',
    disabled: isBatchProcessing.value,
    onClick: handleBatchMessage,
  },
]);

watch(
  filteredProfiles,
  (profiles) => {
    const validIds = new Set(profiles.filter((profile) => !isProfileDisabled(profile.id)).map((profile) => profile.id));
    selectedProfileIds.value = selectedProfileIds.value.filter((id) => validIds.has(id));
  },
  { immediate: true }
);

watch(selectionCount, (count) => {
  if (count === 0 && showMessageModal.value) {
    closeMessageModal();
  }
});

onMounted(async () => {
  await profileList.loadProfiles();
});

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return;
  copyResetTimers.forEach((timer) => window.clearTimeout(timer));
  copyResetTimers.clear();
});
</script>

<template>
  <section class="container-lg space-y-6 py-5 text-white">
    <header class="space-y-1">
      <div>
        <h1 class="text-3xl font-semibold">Profiles</h1>
        <p class="text-white/70">Search, review, and jump into any profile.</p>
      </div>
    </header>

    <div class="flex flex-col gap-4 rounded border border-white/10 bg-white/5 p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="relative w-full md:max-w-md">
          <Icon icon="mdi:magnify" class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search by name or handle"
            class="w-full rounded border border-white/20 bg-black/40 py-3 pl-12 pr-4 text-white placeholder:text-white/40 focus:border-white focus:outline-none"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="flex items-center gap-2 rounded border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white hover:text-black"
            @click="handleInviteProfile"
          >
            <Icon icon="mdi:account-plus" class="h-4 w-4" />
            Invite profile
          </button>
          <RefreshButton size="sm" :refresh="handleRefresh" :loading="profileList.loading.value" title="Refresh profiles" />
        </div>
      </div>

      <div v-if="profileList.loading.value" class="rounded border border-white/15 bg-black/30 p-4 text-white/70">
        Loading profiles…
      </div>

      <div v-else-if="profileList.error.value" class="rounded border border-rose-400/40 bg-rose-500/10 p-4 text-white">
        <p class="font-semibold">{{ profileList.error.value }}</p>
        <p class="text-sm text-white/80">Try refreshing or check back later.</p>
      </div>

      <div v-else class="overflow-hidden rounded border border-white/10">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead class="bg-white/5 text-xs uppercase tracking-wide text-white/70">
              <tr>
                <th scope="col" class="w-12 px-4 py-3">
                  <label class="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-white/40 bg-transparent text-black"
                      :checked="allSelectableSelected"
                      :disabled="selectableProfiles.length === 0"
                      @change="handleSelectAllChange"
                    />
                    <span class="sr-only">Select all profiles</span>
                  </label>
                </th>
                <th scope="col" class="px-4 py-3">Handle</th>
                <th scope="col" class="px-4 py-3">Name</th>
                <th scope="col" class="px-4 py-3">Role</th>
                <th scope="col" class="px-4 py-3">XP</th>
                <th scope="col" class="px-4 py-3">Joined</th>
                <th scope="col" class="px-4 py-3">Status</th>
                <th scope="col" class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredProfiles.length === 0">
                <td colspan="8" class="px-4 py-6 text-center text-white/70">
                  {{ searchQuery ? 'No profiles match your search.' : 'No profiles found yet.' }}
                </td>
              </tr>
              <tr
                v-for="profile in filteredProfiles"
                :key="profile.id"
                :data-state="isProfileDisabled(profile.id) ? 'disabled' : isProfileSelected(profile.id) ? 'selected' : 'enabled'"
                :aria-disabled="isProfileDisabled(profile.id)"
                class="border-b border-white/10 text-white transition-colors last:border-0"
                :class="[
                  isProfileSelected(profile.id) ? 'bg-white/10' : 'hover:bg-white/5',
                  isProfileDisabled(profile.id) ? 'opacity-50' : 'cursor-pointer'
                ]"
                @click="() => toggleProfileSelection(profile.id)"
              >
                <td class="px-4 py-3">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-white/40 bg-transparent"
                    :checked="isProfileSelected(profile.id)"
                    :disabled="isProfileDisabled(profile.id)"
                    @click.stop
                    @change="() => toggleProfileSelection(profile.id)"
                  />
                </td>
                <td class="px-4 py-3 font-mono text-sm">
                  {{ profile.username ? `@${profile.username}` : '—' }}
                </td>
                <td class="px-4 py-3">
                  <p class="font-semibold">{{ profile.name }}</p>
                </td>
                <td class="px-4 py-3 capitalize">
                  {{ profile.role }}
                </td>
                <td class="px-4 py-3">
                  {{ profile.xp ?? '—' }}
                </td>
                <td class="px-4 py-3">
                  {{ formatDate(profile.creation_time) }}
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide"
                    :class="isProfileDisabled(profile.id) ? 'border-amber-300/50 text-amber-200' : 'border-emerald-300/50 text-emerald-200'"
                  >
                    {{ isProfileDisabled(profile.id) ? 'Disabled' : 'Enabled' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <RouterLink
                      class="text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
                      :to="profile.username ? `/v2/profile/${profile.username}` : `/v2/profile/${profile.id}`"
                      @click.stop
                    >
                      View
                    </RouterLink>
                    <button
                      type="button"
                      class="text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
                      :title="`Copy ID ${profile.id}`"
                      @click.stop="() => copyProfileIdToClipboard(profile.id)"
                    >
                      {{ copyLabel(profile.id) }}
                    </button>
                    <button
                      type="button"
                      class="text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
                      @click.stop="() => toggleProfileDisable(profile.id)"
                    >
                      {{ isProfileDisabled(profile.id) ? 'Enable' : 'Disable' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <BatchActionBar
      :selected-count="selectionCount"
      :actions="profileBatchActions"
      @cancel="clearProfileSelection"
    />

    <teleport to="body">
      <transition name="message-modal">
        <div
          v-if="showMessageModal"
          class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Send message to selected profiles"
          @click.self="closeMessageModal"
        >
          <div class="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-[#0f1016] text-white shadow-2xl">
            <header class="border-b border-white/10 px-6 py-4">
              <p class="text-xs uppercase tracking-wide text-white/50">Batch message</p>
              <h2 class="text-xl font-semibold">Message selected profiles</h2>
            </header>
            <div class="space-y-3 px-6 py-5">
              <p class="text-sm text-white/70">
                Draft a quick update for {{ selectionCount }} profile{{ selectionCount === 1 ? '' : 's' }}. They’ll receive it according to their notification preferences.
              </p>
              <label class="block text-sm font-semibold uppercase tracking-wide text-white/60" for="admin-message-body">
                Message
              </label>
              <textarea
                id="admin-message-body"
                v-model="messageBody"
                rows="6"
                class="w-full rounded border border-white/20 bg-black/40 p-3 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                placeholder="Share context, next steps, or a reminder…"
              />
              <p v-if="messageError" class="text-sm text-rose-300">{{ messageError }}</p>
            </div>
            <div class="flex justify-end gap-3 border-t border-white/10 bg-black/40 px-6 py-4">
              <button
                type="button"
                class="rounded border border-white/30 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
                :disabled="isBatchProcessing"
                @click="closeMessageModal"
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded border border-blue-500 bg-blue-600 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!canSendMessage"
                @click="handleSendMessage"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </section>
</template>

<style scoped>
.message-modal-enter-active,
.message-modal-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.message-modal-enter-from,
.message-modal-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>


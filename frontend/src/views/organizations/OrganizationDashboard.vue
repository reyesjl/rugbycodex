<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { getOrganizationBySlug, updateBioById, type Organization } from '@/services/org_service';
import LoadingIcon from '@/components/LoadingIcon.vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{ orgSlug: string }>();

const authStore = useAuthStore();


const loading = ref(true);
const error = ref<string | null>(null);
const org = ref<Organization | null>(null);

// Bio editing state
const isEditingBio = ref(false);
const bioEditText = ref('');
const savingBio = ref(false);
const bioError = ref<string | null>(null);

const startEditingBio = () => {
  bioEditText.value = org.value?.bio ?? '';
  isEditingBio.value = true;
};

const cancelEditingBio = () => {
  isEditingBio.value = false;
  bioError.value = null;
};

const saveBio = async () => {
  if (!org.value?.id) return;
  if (bioEditText.value === null || bioEditText.value.trim() === org.value.bio) {
    isEditingBio.value = false;
    return;
  }
  
  savingBio.value = true;
  bioError.value = null;
  
  try {
    await updateBioById(org.value.id, bioEditText.value.trim());
    console.log("Updated!");
    // Update local state
    if (org.value) {
      org.value.bio = bioEditText.value.trim() || null;
    }
    
    isEditingBio.value = false;
  } catch (e: any) {
    console.error(e);
    bioError.value = e?.message ?? 'Failed to update bio';
  } finally {
    savingBio.value = false;
  }
};

onMounted(async () => {
  try {
    loading.value = true;
    org.value = await getOrganizationBySlug(props.orgSlug);
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load organization';
  } finally {
    loading.value = false;
  }
});

const orgName = computed(() => org.value?.name ?? 'Organization');
const orgCreated = computed(() => org.value?.created_at ?? new Date());
const storageLimitMB = computed(() => org.value?.storage_limit_mb ?? 0);
const isOwner = computed(() => org.value?.owner === authStore.user?.id);

// Fake members data
const fakeMemberNames = [
  'Alice Johnson', 'Bob Smith', 'Charlie Davis', 'Diana Martinez',
  'Ethan Brown', 'Fiona Wilson', 'George Taylor', 'Hannah Moore',
  'Ian Anderson', 'Julia Thomas', 'Kevin Jackson', 'Laura White',
  'Michael Harris', 'Nina Martin', 'Oliver Thompson', 'Paula Garcia',
  'Quinn Robinson', 'Rachel Clark', 'Steven Rodriguez', 'Tina Lewis'
];

const fakeMembers = fakeMemberNames.map((name, idx) => ({
  id: `member-${idx}`,
  name,
  role: idx === 0 ? 'owner' : idx < 3 ? 'admin' : 'member',
  joinedAt: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
}));

const showAllMembers = ref(false);
const displayedMembers = computed(() => 
  showAllMembers.value ? fakeMembers : fakeMembers.slice(0, 10)
);
</script>

<template>
  <!-- Loading State -->
  <section v-if="loading" class="container flex min-h-screen items-center justify-center">
    <LoadingIcon />
  </section>

  <!-- Error State -->
  <section v-else-if="!org" class="container flex min-h-screen flex-col items-center justify-center gap-4">
    <p class="text-sm text-red-600 dark:text-red-400">Failed to load: {{ orgSlug }}</p>
    <button
      @click="$router.push('/dashboard')"
      class="rounded-lg border text-neutral-900 dark:text-neutral-100 border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
    >
      Back to Dashboard
    </button>
  </section>

  <!-- Main Content -->
  <section v-else class="container flex min-h-screen flex-col gap-16 pt-32 pb-32">
    <header
      class="rounded-3xl bg-neutral-100/80 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:bg-neutral-900/70 dark:shadow-[0_40px_80px_rgba(15,23,42,0.35)]">
      <h1 class="mt-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        {{ orgName }}
      </h1>
      <p class="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
        Organization dashboard page, further details coming soon.
      </p>
    </header>

    <section class="grid gap-8 md:grid-cols-2">
      <article
        class="rounded-3xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
        <h2 class="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
          Organization Info
        </h2>
        <dl class="mt-6 space-y-4 text-neutral-700 dark:text-neutral-200">
          <div>
            <dt class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
              Created
            </dt>
            <dd class="mt-1 text-sm">
              {{ orgCreated.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
              Storage Limit
            </dt>
            <dd class="mt-1 text-lg font-medium">
              {{ (storageLimitMB / 1024.0).toFixed(1) }} GB
            </dd>
          </div>
        </dl>
      </article>

      <!-- Bio Section -->
      <article
        class="rounded-3xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
            About
          </h2>
          <button
            v-if="isOwner && !isEditingBio"
            @click="startEditingBio"
            class="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            aria-label="Edit bio"
          >
            <Icon icon="carbon:edit" class="h-4 w-4" />
          </button>
        </div>

        <!-- View Mode -->
        <div v-if="!isEditingBio" class="mt-6 min-h-[240px] text-neutral-700 dark:text-neutral-200">
          <p v-if="org?.bio" class="text-sm leading-relaxed whitespace-pre-wrap">
            {{ org.bio }}
          </p>
          <p v-else class="text-sm italic text-neutral-500 dark:text-neutral-400">
            No bio available.
          </p>
        </div>

        <!-- Edit Mode -->
        <div v-else class="mt-6">
          <textarea
            v-model="bioEditText"
            rows="10"
            class="w-full resize-none rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-900 shadow-sm transition placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500/20 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-500/20"
            placeholder="Enter organization bio..."
          ></textarea>
          
          <div v-if="bioError" class="mt-2 text-sm text-red-600 dark:text-red-400">
            {{ bioError }}
          </div>
          
          <div class="mt-3 flex gap-2">
            <button
              @click="saveBio"
              :disabled="savingBio"
              class="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <span v-if="savingBio">Saving...</span>
              <span v-else>Save</span>
            </button>
            <button
              @click="cancelEditingBio"
              :disabled="savingBio"
              class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </article>
    </section>

    <!-- Members Section (Owner Only) -->
    <section v-if="isOwner" class="grid gap-8">
      <article
        class="rounded-3xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
            Members
          </h2>
          <span class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ fakeMembers.length }} total
          </span>
        </div>

        <div class="mt-6 max-h-96 overflow-y-auto">
          <ul class="space-y-2 text-neutral-700 dark:text-neutral-200">
            <li
              v-for="member in displayedMembers"
              :key="member.id"
              class="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50"
            >
              <span class="font-medium">{{ member.name }}</span>
              <div class="flex items-center gap-3">
                <span class="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {{ member.role }}
                </span>
                <span class="text-xs text-neutral-400 dark:text-neutral-500">
                  {{ member.joinedAt.toLocaleDateString() }}
                </span>
              </div>
            </li>
          </ul>
        </div>

        <button
          v-if="!showAllMembers && fakeMembers.length > 10"
          @click="showAllMembers = true"
          class="mt-4 w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Show all {{ fakeMembers.length }} members
        </button>

        <button
          v-if="showAllMembers"
          @click="showAllMembers = false"
          class="mt-4 w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Show less
        </button>
      </article>
    </section>

    <section v-else class="grid gap-8">
      <article
        class="rounded-3xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
            Members
          </h2>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-lg text-neutral-300 dark:text-neutral-300">
            You don't have permission to view member details.
          </span>
        </div>
      </article>
    </section>
  </section>
</template>

<style scoped>
/* Custom scrollbar styling */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgb(212 212 212 / 0.6);
  border-radius: 4px;
  transition: background 0.2s ease;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgb(163 163 163 / 0.8);
}

/* Dark mode scrollbar */
:global(.dark) .overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgb(64 64 64 / 0.6);
}

:global(.dark) .overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgb(82 82 82 / 0.8);
}

/* Firefox scrollbar */
.overflow-y-auto {
  scrollbar-width: thin;
  scrollbar-color: rgb(212 212 212 / 0.6) transparent;
}

:global(.dark) .overflow-y-auto {
  scrollbar-color: rgb(64 64 64 / 0.6) transparent;
}
</style>
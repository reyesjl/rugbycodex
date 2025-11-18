<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { nextTick } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { getOrganizationBySlug, updateBioById, type Organization } from '@/services/org_service';
import LoadingIcon from '@/components/LoadingIcon.vue';
import { Icon } from '@iconify/vue';
import type { ProfileWithMembership, OrgRole } from '@/types';
import { getOrganizationMembers } from '@/services/profile_service';
import CustomSelect from '@/components/CustomSelect.vue';

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

// Members state
const members = ref<ProfileWithMembership[]>([]);
const membersLoading = ref(true);
const memberLoadError = ref<string | null>(null);
const searchQuery = ref('');
const refreshSuccess = ref(false);

const orgRoleOptions = [
  { label: 'Owner', value: 'owner' },
  { label: 'Manager', value: 'manager' },
  { label: 'Admin', value: 'admin' },
  { label: 'Member', value: 'member' },
  { label: 'Viewer', value: 'viewer' },
]

const memberCount = computed(() => {
  return members.value.length;
});

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
  if (bioEditText.value.trim() === (org.value.bio || '')) {
    isEditingBio.value = false;
    return;
  }

  savingBio.value = true;
  bioError.value = null;

  try {
    await updateBioById(org.value.id, bioEditText.value.trim());
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

async function loadMembers() {
  if (!org.value) {
    memberLoadError.value = "No Organization Present";
    members.value = []
    return;
  }

  membersLoading.value = true;
  try {
    members.value = await getOrganizationMembers(org.value.id);
    console.log('Loaded members:', members.value);
  } catch (e) {
    memberLoadError.value = e instanceof Error ? e.message : 'Failed to fetch members';
    members.value = []
  } finally {
    membersLoading.value = false;
  }
}

async function handleMemberRoleChange(member: ProfileWithMembership, memberId: string, newRole: OrgRole) {
  //TODO: Implement backend update logic here
  // console.log('Member role: ', member.org_role);
  // console.log('Changing role for member:', memberId, 'to', newRole);
  // member.org_role = newRole;
  // const member = members.value.find(m => m.id === memberId);
  // if (!member || !org.value) return;

  // try {
  //   // Update role in backend (assuming updateMemberRole is a service function)
  //   await updateMemberRole(org.value.id, memberId, newRole);

  //   // Update local state
  //   member.org_role = newRole;
  // } catch (e: any) {
  //   console.error(e);
  //   memberLoadError.value = e?.message ?? 'Failed to update member role';
  // }
}

onMounted(async () => {
  try {
    org.value = await getOrganizationBySlug(props.orgSlug);
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load organization';
  } finally {
    loading.value = false;
  }

  await loadMembers();
});

const orgName = computed(() => org.value?.name ?? 'Organization');
const orgCreated = computed(() => org.value?.created_at ?? new Date());
const storageLimitMB = computed(() => org.value?.storage_limit_mb ?? 0);
const canEdit = computed(() => org.value?.owner === authStore.user?.id || authStore.isAdmin);

const showAllMembers = ref(false);
const filteredMembers = computed(() => {
  let result = members.value;
  if (!searchQuery.value.trim()) {
    return result;
  }
  const query = searchQuery.value.toLowerCase();
  result = result.filter(member =>
    member.name.toLowerCase().includes(query) ||
    member.id.toLowerCase().includes(query)
  );
  return result;
});

const displayedMembers = computed(() =>
  showAllMembers.value ? filteredMembers.value : filteredMembers.value.slice(0, 10)
);

async function handleRefreshMembers() {
  await loadMembers();
  refreshSuccess.value = true;
  await nextTick();
  setTimeout(() => {
    refreshSuccess.value = false;
  }, 1000);
}
</script>

<template>
  <!-- Loading State -->
  <section v-if="loading" class="container flex min-h-screen items-center justify-center">
    <LoadingIcon text="Loading Organization ..." />
  </section>

  <section v-else-if="error" class="container flex min-h-screen items-center justify-center">
    <p class="text-sm text-red-600 dark:text-red-400">Error: {{ error }}</p>
  </section>

  <!-- Error State -->
  <section v-else-if="!org" class="container flex min-h-screen flex-col items-center justify-center gap-4">
    <p class="text-sm text-red-600 dark:text-red-400">Failed to load: {{ orgSlug }}</p>
    <button @click="$router.push('/dashboard')"
      class="rounded-lg border text-neutral-900 dark:text-neutral-100 border-neutral-300 px-4 py-2 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
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
        class=" rounded-3xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
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
          <button v-if="canEdit && !isEditingBio" @click="startEditingBio"
            class="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            aria-label="Edit bio">
            <Icon icon="carbon:edit" class="h-4 w-4" />
          </button>
        </div>

        <!-- View Mode -->
        <div v-if="!isEditingBio"
          class="mt-6 pr-2 min-h-[15vh] max-h-[30vh] overflow-y-auto text-neutral-700 dark:text-neutral-200">
          <p v-if="org?.bio" class="text-sm leading-relaxed whitespace-pre-wrap">
            {{ org.bio }}
          </p>
          <p v-else class="text-sm italic text-neutral-500 dark:text-neutral-400">
            No bio available.
          </p>
        </div>

        <!-- Edit Mode -->
        <div v-else class="mt-6">
          <textarea v-model="bioEditText" rows="10"
            class="w-full resize-none rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-900 shadow-sm transition placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500/20 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-500/20"
            placeholder="Enter organization bio..."></textarea>

          <div v-if="bioError" class="mt-2 text-sm text-red-600 dark:text-red-400">
            {{ bioError }}
          </div>

          <div class="mt-3 flex gap-2">
            <button @click="saveBio" :disabled="savingBio"
              class="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200">
              <span v-if="savingBio">Saving...</span>
              <span v-else>Save</span>
            </button>
            <button @click="cancelEditingBio" :disabled="savingBio"
              class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
              Cancel
            </button>
          </div>
        </div>
      </article>
    </section>

    <!-- Members Section (Owner Only) -->
    <section v-if="canEdit" class="grid gap-8">
      <div v-if="memberLoadError" class="mt-4">
        <p class="text-sm text-rose-500 dark:text-rose-400">Error: {{ memberLoadError }}</p>
      </div>
      <div v-else class="scrolling-list mt-4 overflow-y-auto space-y-4 pr-2">
        <div v-if="members.length === 0 && !membersLoading" class="mt-4">
          <p class="text-neutral-600 dark:text-neutral-400">
            No members found.
          </p>
        </div>
        <div v-else>
          <article
            class="rounded-3xl border border-neutral-200/60 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-colors dark:border-neutral-800/70 dark:bg-neutral-950/70 dark:shadow-[0_24px_60px_rgba(15,23,42,0.35)]">

            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
                Members
              </h2>
              <div class="flex items-center gap-2">
                <span class="text-xs text-neutral-500 dark:text-neutral-400">
                  {{ filteredMembers.length }} total
                </span>
                <button type="button" @click="handleRefreshMembers" :disabled="membersLoading"
                  class="rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-60" :class="refreshSuccess
                    ? 'text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30'
                    : 'text-neutral-900 hover:bg-neutral-200 dark:text-neutral-100 dark:hover:bg-neutral-800'"
                  title="Refresh members">
                  <Icon :icon="refreshSuccess ? 'mdi:check' : 'mdi:refresh'" class="h-5 w-5"
                    :class="{ 'animate-spin': membersLoading }" />
                </button>
              </div>
            </div>

            <div class="mt-4">
              <div class="relative">
                <Icon icon="mdi:magnify" class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                <input v-model="searchQuery" type="text" placeholder="Search by member name or ID..."
                  class="w-full rounded-xl border border-neutral-300 bg-white py-3 pl-12 text-neutral-900 transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/20" />
              </div>
            </div>

            <div class="mt-6 max-h-96 ">
              <ul class="space-y-2 text-neutral-700 max-h-[30vh] overflow-y-auto dark:text-neutral-200">
                <li v-for="member in displayedMembers" :key="member.id"
                  class="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50">
                  <span class="font-medium">{{ member.name }}</span>
                  <div class="flex items-center gap-3">
                    <!-- <span class="text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      {{ member.org_role }}
                    </span> -->
                    <CustomSelect
                      :options="orgRoleOptions"
                      :model-value="member.org_role"
                      @update:model-value="(newRole: number | string) => handleMemberRoleChange(member, member.id, newRole as OrgRole)"
                      class="w-32 text-xs"
                    />
                    <span class="text-xs text-neutral-400 dark:text-neutral-500">
                      {{ member.join_date.toLocaleDateString() }}
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            <button v-if="!showAllMembers && memberCount > 10" @click="showAllMembers = true"
              class="mt-4 w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
              Show all {{ memberCount }} members
            </button>

            <button v-if="showAllMembers" @click="showAllMembers = false"
              class="mt-4 w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
              Show less
            </button>
          </article>
        </div>
      </div>
    </section>
  </section>
</template>

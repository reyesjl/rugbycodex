<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import {
  getProfileById,
  addMembershipToProfile,
  removeMembershipFromProfile,
  type ProfileWithMemberships,
} from '@/services/profile_service';
import { getAllOrganizations, type Organization } from '@/services/org_service';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import type { OrgMembership } from '@/types';
import CustomSelect from '@/components/CustomSelect.vue';
import { MEMBERSHIP_ROLES } from '@/constants/memberships';

const route = useRoute();
const router = useRouter();

const profile = ref<ProfileWithMemberships | null>(null);
const organizations = ref<Organization[]>([]);
const profileLoading = ref(true);
const profileError = ref<string | null>(null);

const addMembershipError = ref<string | null>(null);
const isAddingMembership = ref(false);
const selectedOrgSlug = ref('');
const selectedRole = ref('member');
const searchOrgQuery = ref('');
const showOrgDropdown = ref(false);

const showDeleteModal = ref(false);
const membershipToDelete = ref<OrgMembership | null>(null);
const isDeletingMembership = ref(false);
const membershipDeleteError = ref<string | null>(null);

const availableRoles = MEMBERSHIP_ROLES;

const loadProfile = async () => {
  const userId = route.params.id as string;
  if (!userId) {
    profileError.value = 'No profile ID provided.';
    profileLoading.value = false;
    return;
  }

  profileLoading.value = true;
  profileError.value = null;

  try {
    profile.value = await getProfileById(userId);
  } catch (error) {
    profileError.value = error instanceof Error ? error.message : 'Failed to load profile.';
  } finally {
    profileLoading.value = false;
  }
};

const loadOrganizations = async () => {
  try {
    organizations.value = await getAllOrganizations();
  } catch (error) {
    console.error('Failed to load organizations:', error);
  }
};

const filteredOrganizations = computed(() => {
  if (!searchOrgQuery.value.trim()) {
    return organizations.value;
  }
  const query = searchOrgQuery.value.toLowerCase();
  return organizations.value.filter(org =>
    org.name.toLowerCase().includes(query) || org.slug.toLowerCase().includes(query)
  );
});

const availableOrganizations = computed(() => {
  if (!profile.value) return filteredOrganizations.value;
  
  const memberOrgIds = new Set(profile.value.memberships.map(m => m.org_id));
  return filteredOrganizations.value.filter(org => !memberOrgIds.has(org.id));
});

const handleAddMembership = async () => {
  if (!profile.value || !selectedOrgSlug.value) return;

  isAddingMembership.value = true;
  addMembershipError.value = null;

  try {
    await addMembershipToProfile(profile.value.id, selectedOrgSlug.value, selectedRole.value);
    await loadProfile();
    selectedOrgSlug.value = '';
    selectedRole.value = 'member';
    searchOrgQuery.value = '';
    showOrgDropdown.value = false;
  } catch (error) {
    addMembershipError.value = error instanceof Error ? error.message : 'Failed to add membership.';
  } finally {
    isAddingMembership.value = false;
  }
};

const openDeleteModal = (membership: OrgMembership) => {
  membershipToDelete.value = membership;
  showDeleteModal.value = true;
};

const closeDeleteModal = () => {
  if (!isDeletingMembership.value) {
    showDeleteModal.value = false;
    membershipToDelete.value = null;
    membershipDeleteError.value = null;
  }
};

const confirmDeleteMembership = async () => {
  if (!profile.value || !membershipToDelete.value) return;

  isDeletingMembership.value = true;
  membershipDeleteError.value = null;

  try {
    await removeMembershipFromProfile(profile.value.id, membershipToDelete.value.org_id);
    await loadProfile();
    showDeleteModal.value = false;
    membershipToDelete.value = null;
  } catch (error) {
    membershipDeleteError.value = error instanceof Error ? error.message : 'Failed to remove membership.';
  } finally {
    isDeletingMembership.value = false;
  }
};

const selectOrganization = (slug: string) => {
  selectedOrgSlug.value = slug;
  showOrgDropdown.value = false;
  searchOrgQuery.value = organizations.value.find(org => org.slug === slug)?.name || '';
};

const getSelectedOrgName = computed(() => {
  if (!selectedOrgSlug.value) return '';
  const org = organizations.value.find(org => org.slug === selectedOrgSlug.value);
  return org?.name || '';
});

const deleteText = computed(() => {
  if (!membershipToDelete.value || !profile.value) return '';
  return `Membership to ${membershipToDelete.value.org_name} for profile ${profile.value.name}`;
});

onMounted(async () => {
  await Promise.all([loadProfile(), loadOrganizations()]);
});
</script>

<template>
  <section class="base-container container flex min-h-screen flex-col gap-16 pt-32 pb-32">
    <header
      class="rounded-3xl bg-neutral-100/80 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:bg-neutral-900/70 dark:shadow-[0_40px_80px_rgba(15,23,42,0.35)]">
      <div class="flex items-center gap-4">
        <button type="button" @click="router.back()"
          class="rounded-lg p-2 text-neutral-900 transition hover:bg-neutral-200 dark:text-neutral-100 dark:hover:bg-neutral-800"
          title="Go back">
          <Icon icon="mdi:arrow-left" class="h-5 w-5" />
        </button>
        <div class="flex-1">
          <p class="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-500">
            Rugbycodex Admin
          </p>
          <h1 class="mt-3 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {{ profile?.name || 'Profile Details' }}
          </h1>
          <p class="mt-4 max-w-xl text-neutral-600 dark:text-neutral-400">
            View and manage profile information and organization memberships.</p>
        </div>
      </div>
    </header>

    <div v-if="profileLoading" class="text-center">
      <Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-neutral-500" />
    </div>

    <div v-else-if="profileError"
      class="rounded-3xl bg-neutral-100/80 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:bg-neutral-900/70 dark:shadow-[0_40px_80px_rgba(15,23,42,0.35)]">
      <p class="text-sm text-rose-500 dark:text-rose-400">Error: {{ profileError }}</p>
    </div>

    <template v-else-if="profile">
      <!-- Profile Information -->
      <section
        class="rounded-3xl bg-neutral-100/80 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:bg-neutral-900/70 dark:shadow-[0_40px_80px_rgba(15,23,42,0.35)]">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Profile Information</h2>
        <div class="mt-6 space-y-3">
          <div class="flex justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-sm font-medium text-neutral-600 dark:text-neutral-400">ID:</span>
            <span class="text-sm text-neutral-900 dark:text-neutral-100">{{ profile.id }}</span>
          </div>
          <div class="flex justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-sm font-medium text-neutral-600 dark:text-neutral-400">Name:</span>
            <span class="text-sm text-neutral-900 dark:text-neutral-100">{{ profile.name }}</span>
          </div>
          <div class="flex justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-sm font-medium text-neutral-600 dark:text-neutral-400">Role:</span>
            <span class="text-sm text-neutral-900 dark:text-neutral-100 capitalize">{{ profile.role }}</span>
          </div>
          <div class="flex justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-sm font-medium text-neutral-600 dark:text-neutral-400">XP:</span>
            <span class="text-sm text-neutral-900 dark:text-neutral-100">{{ profile.xp ?? 'N/A' }}</span>
          </div>
          <div class="flex justify-between border-b border-neutral-200 pb-2 dark:border-neutral-800">
            <span class="text-sm font-medium text-neutral-600 dark:text-neutral-400">Created:</span>
            <span class="text-sm text-neutral-900 dark:text-neutral-100">{{ profile.creation_time.toLocaleString()
              }}</span>
          </div>
        </div>
      </section>

      <!-- Memberships Section -->
      <section
        class="rounded-3xl bg-neutral-100/80 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:bg-neutral-900/70 dark:shadow-[0_40px_80px_rgba(15,23,42,0.35)]">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Organization Memberships</h2>

        <!-- Add Membership Form -->
        <div class="mt-6 rounded-xl border border-neutral-200 bg-white/50 p-6 dark:border-neutral-800 dark:bg-neutral-950/50">
          <h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">Add Membership</h3>
          
          <div class="mt-4 space-y-4">
            <!-- Organization Select with Search -->
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Organization
              </label>
              <div class="relative mt-2">
                <div class="relative">
                  <Icon icon="mdi:magnify" class="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                  <input
                    v-model="searchOrgQuery"
                    @focus="showOrgDropdown = true"
                    type="text"
                    :placeholder="getSelectedOrgName || 'Search organizations...'"
                    class="w-full rounded-xl border border-neutral-300 bg-white py-3 pl-12 pr-4 text-neutral-900 transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/20"
                  />
                </div>
                
                <Transition
                  enter-active-class="transition duration-100 ease-out"
                  enter-from-class="transform scale-95 opacity-0"
                  enter-to-class="transform scale-100 opacity-100"
                  leave-active-class="transition duration-75 ease-in"
                  leave-from-class="transform scale-100 opacity-100"
                  leave-to-class="transform scale-95 opacity-0"
                >
                  <div
                    v-if="showOrgDropdown"
                    class="absolute z-10 mt-2 w-full overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-950"
                    @mouseleave="showOrgDropdown = false"
                  >
                    <ul class="max-h-60 overflow-auto py-1">
                      <li
                        v-if="availableOrganizations.length === 0"
                        class="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400"
                      >
                        No available organizations
                      </li>
                      <li
                        v-for="org in availableOrganizations"
                        :key="org.id"
                        @click="selectOrganization(org.slug)"
                        :class="[
                          'cursor-pointer px-4 py-3 text-neutral-900 transition dark:text-neutral-100',
                          selectedOrgSlug === org.slug
                            ? 'bg-neutral-200 font-semibold dark:bg-neutral-800'
                            : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'
                        ]"
                      >
                        <div class="flex flex-col">
                          <span class="font-medium">{{ org.name }}</span>
                          <span class="text-xs text-neutral-500 dark:text-neutral-400">{{ org.slug }}</span>
                        </div>
                      </li>
                    </ul>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Role Select -->
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Role
              </label>
              <CustomSelect
                v-model="selectedRole"
                :options="availableRoles"
                placeholder="Select role"
              />
            </div>

            <div v-if="addMembershipError" class="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/30">
              <p class="text-sm text-rose-600 dark:text-rose-400">{{ addMembershipError }}</p>
            </div>

            <button
              type="button"
              @click="handleAddMembership"
              :disabled="!selectedOrgSlug || isAddingMembership"
              class="w-full rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <span v-if="isAddingMembership" class="flex items-center justify-center gap-2">
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                Adding...
              </span>
              <span v-else>Add Membership</span>
            </button>
          </div>
        </div>

        <!-- Memberships List -->
        <div v-if="profile.memberships.length === 0" class="mt-6">
          <p class="text-neutral-600 dark:text-neutral-400">No organization memberships.</p>
        </div>
        <div v-else class="mt-6 space-y-3">
          <TransitionGroup name="membership-list" tag="div" class="space-y-3">
            <div
              v-for="membership in profile.memberships"
              :key="membership.org_id"
              class="flex items-center justify-between rounded-lg border border-neutral-200 bg-white/50 p-4 dark:border-neutral-800 dark:bg-neutral-950/50"
            >
              <div class="flex-1">
                <RouterLink
                  :to="`/organizations/${membership.slug}`"
                  class="font-medium text-neutral-900 hover:underline dark:text-neutral-100"
                >
                  {{ membership.org_name }}
                </RouterLink>
                <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {{ membership.role.toUpperCase() }} • Joined: {{ membership.join_date.toLocaleDateString() }}
                </p>
              </div>
              <button
                type="button"
                @click="openDeleteModal(membership)"
                class="rounded-lg p-2 text-rose-600 transition hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/30"
                title="Remove membership"
              >
                <Icon icon="mdi:trash-can-outline" class="h-5 w-5" />
              </button>
            </div>
          </TransitionGroup>
        </div>
      </section>
    </template>

    <!-- Delete Membership Confirmation Modal -->
    <ConfirmDeleteModal
      :show="showDeleteModal"
      :item-name="deleteText"
      :is-deleting="isDeletingMembership"
      :error="membershipDeleteError"
      :popupTitle="'Remove Membership'"
      @confirm="confirmDeleteMembership"
      @cancel="closeDeleteModal"
      @close="closeDeleteModal"
    />
  </section>
</template>

<style scoped>
/* TransitionGroup animation for membership list */
.membership-list-move,
.membership-list-enter-active,
.membership-list-leave-active {
  transition: all 0.5s ease;
}

.membership-list-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.membership-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.membership-list-leave-active {
  position: absolute;
  width: 100%;
}
</style>

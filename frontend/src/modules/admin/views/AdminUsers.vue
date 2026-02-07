<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onMounted, ref, watch } from "vue";
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { profileService } from "@/modules/profiles/services/profileServiceV2";
import { toast } from "@/lib/toast";
import UserDetailsModal from '@/modules/admin/components/UserDetailsModal.vue';
import EditUserRoleModal from '@/modules/admin/components/EditUserRoleModal.vue';
import type { AdminUserListItem, UserOrgMembership } from "@/modules/profiles/types";
import { useUserContextStore } from "@/modules/user/stores/useUserContextStore";

const userStore = useUserContextStore();

const users = ref<AdminUserListItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Filter and pagination state
const searchQuery = ref('');
const debouncedSearch = ref('');
const searchDebounceTimer = ref<NodeJS.Timeout | null>(null);
const roleFilter = ref<'all' | 'user' | 'admin'>('all');
const activityFilter = ref<'all' | 'active' | 'inactive'>('all');
const itemsPerPage = ref(20);
const currentPage = ref(1);
const totalCount = ref(0);
const totalUsersCount = ref(0);

// Modal states
const showDetailsModal = ref(false);
const showEditRoleModal = ref(false);
const selectedUser = ref<AdminUserListItem | null>(null);
const selectedUserOrgs = ref<UserOrgMembership[]>([]);
const isUpdatingRole = ref(false);
const isLoadingOrgs = ref(false);

// Computed
const totalPages = computed(() => Math.ceil(totalCount.value / itemsPerPage.value));

const visiblePageNumbers = computed(() => {
  const pages: (number | string)[] = [];
  const total = totalPages.value;
  const current = currentPage.value;

  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (current > 3) {
      pages.push('...');
    }
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (current < total - 2) {
      pages.push('...');
    }
    pages.push(total);
  }
  return pages;
});

const filteredUsers = computed(() => {
  let filtered = [...users.value];
  
  // Client-side activity filtering
  if (activityFilter.value === 'active') {
    filtered = filtered.filter(u => u.primary_org !== null);
  } else if (activityFilter.value === 'inactive') {
    filtered = filtered.filter(u => u.primary_org === null);
  }
  
  return filtered;
});

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredUsers.value.slice(start, end);
});

const loadUsers = async () => {
  loading.value = true;
  error.value = null;
  try {
    const filters: any = {
      limit: 9999, // Load all for client-side pagination
      offset: 0,
    };
    
    if (debouncedSearch.value.trim()) {
      filters.search = debouncedSearch.value.trim();
    }
    
    if (roleFilter.value !== 'all') {
      filters.role = roleFilter.value;
    }
    
    users.value = await profileService.listAllUsers(filters);
    totalCount.value = filteredUsers.value.length;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load users.";
    error.value = message;
    toast({
      variant: "error",
      message,
    });
  } finally {
    loading.value = false;
  }
};

const loadTotalCount = async () => {
  try {
    const allUsers = await profileService.listAllUsers({ limit: 99999, offset: 0 });
    totalUsersCount.value = allUsers.length;
  } catch (err) {
    console.error('Failed to load total user count:', err);
  }
};

const formatRelative = (value: Date | string | null | undefined) => {
  if (!value) return "Never";
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return String(value);

  const diffSeconds = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (abs < 60) return rtf.format(diffSeconds, "second");
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, "day");
  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) return rtf.format(diffWeeks, "week");
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, "month");
  const diffYears = Math.round(diffDays / 365);
  return rtf.format(diffYears, "year");
};

const formatXP = (xp: number) => {
  return xp.toLocaleString();
};

const roleBadgeClass = (role: string) => {
  if (role === 'admin') {
    return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
  }
  return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
};

// Modal actions
const openDetailsModal = async (user: AdminUserListItem) => {
  selectedUser.value = user;
  isLoadingOrgs.value = true;
  showDetailsModal.value = true;
  
  try {
    selectedUserOrgs.value = await profileService.getUserOrganizations(user.id);
  } catch (err) {
    console.error('Failed to load user organizations:', err);
    selectedUserOrgs.value = [];
  } finally {
    isLoadingOrgs.value = false;
  }
};

const closeDetailsModal = () => {
  showDetailsModal.value = false;
  selectedUser.value = null;
  selectedUserOrgs.value = [];
};

const openEditRoleModal = (user: AdminUserListItem) => {
  selectedUser.value = user;
  showEditRoleModal.value = true;
};

const closeEditRoleModal = () => {
  if (isUpdatingRole.value) return;
  showEditRoleModal.value = false;
  selectedUser.value = null;
};

const confirmRoleChange = async (newRole: 'user' | 'admin') => {
  if (!selectedUser.value) return;
  
  isUpdatingRole.value = true;
  try {
    await profileService.updateUserRole(selectedUser.value.id, newRole);
    toast({
      variant: "success",
      message: `Updated ${selectedUser.value.name}'s role to ${newRole}.`,
    });
    closeEditRoleModal();
    await loadUsers();
    await loadTotalCount();
  } catch (err) {
    toast({
      variant: "error",
      message: err instanceof Error ? err.message : "Failed to update user role.",
    });
  } finally {
    isUpdatingRole.value = false;
  }
};

const isSelf = (userId: string) => {
  return userStore.userId === userId;
};

// Pagination functions
const goToPage = (page: number) => {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const resetToFirstPage = () => {
  currentPage.value = 1;
};

// Debounce search input
watch(searchQuery, (newValue) => {
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value);
  }
  
  searchDebounceTimer.value = setTimeout(() => {
    debouncedSearch.value = newValue;
    resetToFirstPage();
  }, 500);
});

// Watch filters to reset to first page and reload
watch([debouncedSearch, roleFilter, activityFilter, itemsPerPage], () => {
  resetToFirstPage();
  void loadUsers();
});

// Watch filtered results to update total count
watch(filteredUsers, (newFiltered) => {
  totalCount.value = newFiltered.length;
});

onMounted(() => {
  void loadUsers();
  void loadTotalCount();
});
</script>

<template>
  <section class="container-lg text-white py-6">
    <div class="flex flex-col gap-4 mb-4">
      <div class="flex items-center gap-3">
        <h1 class="text-3xl">Users</h1>
        <span class="text-lg text-white/40">({{ totalUsersCount.toLocaleString() }})</span>
      </div>
      
      <!-- Filter Bar -->
      <div class="flex flex-col gap-3 text-sm mb-6">
        <!-- First Row: Show Count and Role/Activity Filters -->
        <div class="flex flex-col md:flex-row md:flex-wrap items-start md:items-center gap-4">
          <!-- Show Count -->
          <div class="flex items-center gap-2">
            <span class="text-white/50">Show</span>
            <button
              type="button"
              @click="itemsPerPage = 20; resetToFirstPage()"
              class="transition px-2 py-0.5 rounded"
              :class="itemsPerPage === 20 ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              20
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="itemsPerPage = 50; resetToFirstPage()"
              class="transition px-2 py-0.5 rounded"
              :class="itemsPerPage === 50 ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              50
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="itemsPerPage = 100; resetToFirstPage()"
              class="transition px-2 py-0.5 rounded"
              :class="itemsPerPage === 100 ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              100
            </button>
          </div>

          <!-- Role Filters -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="roleFilter = 'all'"
              class="transition px-2 py-0.5 rounded"
              :class="roleFilter === 'all' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              All
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="roleFilter = 'user'"
              class="transition px-2 py-0.5 rounded"
              :class="roleFilter === 'user' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              Users
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="roleFilter = 'admin'"
              class="transition px-2 py-0.5 rounded"
              :class="roleFilter === 'admin' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              Admins
            </button>
          </div>

          <!-- Activity Filters -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="activityFilter = 'all'"
              class="transition px-2 py-0.5 rounded"
              :class="activityFilter === 'all' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              All Activity
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="activityFilter = 'active'"
              class="transition px-2 py-0.5 rounded"
              :class="activityFilter === 'active' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              Active
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="activityFilter = 'inactive'"
              class="transition px-2 py-0.5 rounded"
              :class="activityFilter === 'inactive' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              Inactive
            </button>
          </div>
        </div>

        <!-- Second Row: Search Bar -->
        <div class="flex items-center gap-3">
          <div class="relative flex-1 max-w-md">
            <Icon 
              icon="carbon:search" 
              class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name or username..."
              class="w-full rounded border border-white/20 bg-black/40 pl-9 pr-3 py-2 text-sm text-white outline-none transition focus:border-white/40"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="rounded-lg border border-white/10 bg-white/5 p-5 animate-pulse">
        <div class="flex items-start justify-between">
          <div class="flex-1 space-y-3">
            <div class="h-5 bg-white/10 rounded w-1/3"></div>
            <div class="h-4 bg-white/10 rounded w-1/4"></div>
          </div>
          <div class="h-6 w-20 bg-white/10 rounded"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="rounded-lg border border-rose-400/40 bg-rose-500/10 p-6 text-white">
      <p class="font-semibold">Unable to load users.</p>
      <p class="mt-2 text-sm text-white/80">{{ error }}</p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="paginatedUsers.length === 0"
      class="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-white/70"
    >
      No users found.
    </div>

    <!-- User Cards -->
    <div v-else class="space-y-3">
      <div
        v-for="user in paginatedUsers"
        :key="user.id"
        class="relative group rounded-lg border border-white/10 bg-white/5 transition cursor-pointer hover:bg-white/10"
        @click="openDetailsModal(user)"
      >
        <div class="p-5">
          <!-- Top Row: Name, Role Badge, Crown, Menu -->
          <div class="flex items-start justify-between gap-4 mb-3">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <h3 class="text-lg font-semibold text-white truncate">
                {{ user.name }}
              </h3>
              <Icon v-if="user.role === 'admin'" icon="carbon:user-admin" class="h-5 w-5 text-purple-400 shrink-0" />
              <span
                class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide shrink-0"
                :class="roleBadgeClass(user.role)"
              >
                {{ user.role }}
              </span>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <!-- Three-dot menu -->
              <Menu as="div" class="relative z-10">
                <MenuButton
                  class="inline-flex items-center justify-center rounded p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
                  @click.stop
                >
                  <Icon icon="carbon:overflow-menu-vertical" class="h-5 w-5" />
                </MenuButton>
                <transition
                  enter-active-class="transition duration-100 ease-out"
                  enter-from-class="transform scale-95 opacity-0"
                  enter-to-class="transform scale-100 opacity-100"
                  leave-active-class="transition duration-75 ease-in"
                  leave-from-class="transform scale-100 opacity-100"
                  leave-to-class="transform scale-95 opacity-0"
                >
                  <MenuItems class="absolute right-0 mt-2 w-48 origin-top-right rounded-lg border border-white/20 bg-gray-900 shadow-lg focus:outline-none overflow-hidden">
                    <MenuItem v-slot="{ active }">
                      <button
                        @click.stop="openDetailsModal(user)"
                        class="w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2"
                        :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                      >
                        <Icon icon="carbon:information" class="h-4 w-4" />
                        View Details
                      </button>
                    </MenuItem>
                    <MenuItem v-slot="{ active }">
                      <button
                        @click.stop="openEditRoleModal(user)"
                        class="w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2"
                        :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                      >
                        <Icon icon="carbon:user-role" class="h-4 w-4" />
                        Edit Role
                      </button>
                    </MenuItem>
                  </MenuItems>
                </transition>
              </Menu>
            </div>
          </div>

          <!-- Second Row: Username, XP, Join Date -->
          <div class="flex items-center gap-2 text-sm text-white/60 mb-2">
            <span class="text-white/70">@{{ user.username }}</span>
            <span class="text-white/30">•</span>
            <span>{{ formatXP(user.xp) }} XP</span>
            <span class="text-white/30">•</span>
            <span>Joined {{ formatRelative(user.creation_time) }}</span>
          </div>

          <!-- Third Row: Primary Org -->
          <div class="text-sm text-white/60 mb-1">
            <span v-if="user.primary_org_name" class="text-white/70">
              Primary: {{ user.primary_org_name }}
            </span>
            <span v-else class="text-white/40">
              No primary organization
            </span>
          </div>

          <!-- Fourth Row: Org Membership Count -->
          <div class="text-xs" :class="user.org_membership_count > 0 ? 'text-white/60' : 'text-white/40'">
            <span v-if="user.org_membership_count === 0">Not in any organizations</span>
            <span v-else-if="user.org_membership_count === 1">Member of 1 organization</span>
            <span v-else>Member of {{ user.org_membership_count }} organizations</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="!loading && paginatedUsers.length > 0 && totalPages > 1" class="flex items-center justify-center gap-2 mt-6">
      <button
        type="button"
        @click="prevPage"
        :disabled="currentPage === 1"
        class="rounded border border-white/20 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Icon icon="carbon:chevron-left" class="h-4 w-4" />
      </button>

      <template v-for="page in visiblePageNumbers" :key="page">
        <button
          v-if="typeof page === 'number'"
          type="button"
          @click="goToPage(page)"
          class="min-w-[2rem] rounded border px-3 py-1 text-sm transition"
          :class="currentPage === page 
            ? 'border-white/40 bg-white/20 text-white font-semibold' 
            : 'border-white/20 bg-white/5 text-white/60 hover:bg-white/10'"
        >
          {{ page }}
        </button>
        <span v-else class="text-white/40 px-1">{{ page }}</span>
      </template>

      <button
        type="button"
        @click="nextPage"
        :disabled="currentPage === totalPages"
        class="rounded border border-white/20 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Icon icon="carbon:chevron-right" class="h-4 w-4" />
      </button>
    </div>

    <!-- Modals -->
    <UserDetailsModal
      :show="showDetailsModal"
      :user="selectedUser"
      :organizations="selectedUserOrgs"
      @close="closeDetailsModal"
    />

    <EditUserRoleModal
      :show="showEditRoleModal"
      :user-name="selectedUser?.name || ''"
      :current-role="selectedUser?.role || 'user'"
      :is-self="selectedUser ? isSelf(selectedUser.id) : false"
      :loading="isUpdatingRole"
      @close="closeEditRoleModal"
      @confirm="confirmRoleChange"
    />
  </section>
</template>

<style scoped>

</style>


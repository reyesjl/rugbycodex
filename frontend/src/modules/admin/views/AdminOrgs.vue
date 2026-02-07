<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { orgService } from "@/modules/orgs/services/orgServiceV2";
import { toast } from "@/lib/toast";
import EditOrgModal from '@/modules/admin/components/EditOrgModal.vue';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue';
import type {
  OrganizationAdminListItem,
  OrganizationVisibility,
  OrganizationType,
  Organization,
} from "@/modules/orgs/types";

const router = useRouter();

const orgs = ref<OrganizationAdminListItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Filter and pagination state
const searchQuery = ref('');
const debouncedSearch = ref('');
const searchDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const statusFilter = ref<'all' | 'active' | 'inactive'>('all');
const typeFilter = ref<'all' | 'team' | 'personal'>('all');
const itemsPerPage = ref(20);
const currentPage = ref(1);
const totalCount = ref(0);
const totalOrgsCount = ref(0);

// Modal states
const showEditModal = ref(false);
const showDeleteModal = ref(false);
const orgToEdit = ref<Organization | null>(null);
const orgToDelete = ref<{ id: string; name: string } | null>(null);
const isDeleting = ref(false);
const deleteError = ref<string | null>(null);

// Computed
const totalPages = computed(() => Math.ceil(totalCount.value / itemsPerPage.value));

const visiblePageNumbers = computed(() => {
  const pages: (number | string)[] = [];
  const total = totalPages.value;
  const current = currentPage.value;

  if (total <= 7) {
    // Show all pages if 7 or fewer
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    // Always show first page
    pages.push(1);

    if (current > 3) {
      pages.push('...');
    }

    // Show pages around current
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push('...');
    }

    // Always show last page
    pages.push(total);
  }

  return pages;
});



const loadOrgs = async () => {
  loading.value = true;
  error.value = null;
  try {
    const offset = (currentPage.value - 1) * itemsPerPage.value;
    
    // Build filters
    const filters: any = {
      limit: itemsPerPage.value,
      offset: offset,
    };
    
    if (debouncedSearch.value.trim()) {
      filters.search = debouncedSearch.value.trim();
    }
    
    if (typeFilter.value !== 'all') {
      filters.type = typeFilter.value;
    }
    
    // Note: Active/Inactive is client-side filter for now
    // To make it server-side, would need to add to RPC
    
    orgs.value = await orgService.listOrganizations(filters);
    
    // Filter client-side for active/inactive
    if (statusFilter.value === 'active') {
      orgs.value = orgs.value.filter(item => isActive(item));
    } else if (statusFilter.value === 'inactive') {
      orgs.value = orgs.value.filter(item => !isActive(item));
    }
    
    // For now, use length as total (since we filter client-side)
    // Ideally this would come from server
    totalCount.value = orgs.value.length;
    
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load organizations.";
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
    // Fetch total count with no filters
    const allOrgs = await orgService.listOrganizations({ limit: 99999, offset: 0 });
    totalOrgsCount.value = allOrgs.length;
  } catch (err) {
    console.error('Failed to load total org count:', err);
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

const formatStorageRatio = (usedBytes: number | null | undefined, limitMb: number | null | undefined) => {
  if (!limitMb) return "0 B / 0 B";
  
  const limitBytes = limitMb * 1024 * 1024;
  const used = usedBytes || 0;
  
  // Determine which unit to use based on the limit (larger value)
  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let testSize = limitBytes;
  
  while (testSize >= 1024 && unitIndex < units.length - 1) {
    testSize /= 1024;
    unitIndex++;
  }
  
  // Convert both to the same unit
  const divisor = Math.pow(1024, unitIndex);
  const usedInUnit = used / divisor;
  const limitInUnit = limitBytes / divisor;
  
  return `${usedInUnit.toFixed(1)} ${units[unitIndex]} / ${limitInUnit.toFixed(1)} ${units[unitIndex]}`;
};

const typeLabel = (type: OrganizationType | null | undefined) => {
  if (type === "team") return "TEAM";
  if (type === "personal") return "PERSONAL";
  return "UNKNOWN";
};

const isActive = (item: OrganizationAdminListItem) => {
  if (!item.last_activity_at) return false;
  const daysSinceActivity = Math.floor(
    (Date.now() - new Date(item.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysSinceActivity < 30;
};

const statusBadgeClass = (item: OrganizationAdminListItem) => {
  return isActive(item)
    ? "bg-green-500/10 text-green-400 border-green-500/20"
    : "bg-gray-500/10 text-gray-400 border-gray-500/20";
};

const statusLabel = (item: OrganizationAdminListItem) => {
  return isActive(item) ? "Active" : "Inactive";
};

const visibilityIcon = (visibility: OrganizationVisibility | null | undefined) => {
  return visibility === "public" ? "carbon:earth" : "carbon:locked";
};

const navigateToOrg = (slug: string) => {
  router.push(`/orgs/${slug}/public`);
};

const openEditModal = (item: OrganizationAdminListItem) => {
  orgToEdit.value = item.organization;
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  orgToEdit.value = null;
};

const handleEditSubmit = async (payload: { 
  name: string; 
  bio: string | null; 
  type: OrganizationType; 
  visibility: OrganizationVisibility;
  storage_limit_mb: number;
}) => {
  if (!orgToEdit.value) return;
  
  try {
    await orgService.updateOrganizationAdmin(orgToEdit.value.id, payload);
    
    toast({
      variant: "success",
      message: "Organization updated successfully.",
    });
    
    closeEditModal();
    await loadOrgs();
  } catch (err) {
    toast({
      variant: "error",
      message: err instanceof Error ? err.message : "Failed to update organization.",
    });
  }
};

const openDeleteModal = (item: OrganizationAdminListItem) => {
  orgToDelete.value = {
    id: item.organization.id,
    name: item.organization.name,
  };
  deleteError.value = null;
  showDeleteModal.value = true;
};

const closeDeleteModal = () => {
  if (isDeleting.value) return;
  showDeleteModal.value = false;
  deleteError.value = null;
  orgToDelete.value = null;
};

const confirmDelete = async () => {
  if (!orgToDelete.value) return;
  
  isDeleting.value = true;
  deleteError.value = null;
  
  try {
    const result = await orgService.deleteOrganizationAdmin(orgToDelete.value.id, false);
    
    toast({
      variant: "success",
      message: result.message || `Organization "${orgToDelete.value.name}" deleted successfully.`,
    });
    
    closeDeleteModal();
    await loadOrgs();
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : "Failed to delete organization.";
  } finally {
    isDeleting.value = false;
  }
};

const getStoragePercentage = (item: OrganizationAdminListItem) => {
  if (!item.storage_used_bytes || !item.organization.storage_limit_mb) return 0;
  return Math.min(100, (item.storage_used_bytes / (item.organization.storage_limit_mb * 1024 * 1024)) * 100);
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
  // Clear existing timer
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value);
  }
  
  // Set new timer
  searchDebounceTimer.value = setTimeout(() => {
    debouncedSearch.value = newValue;
    resetToFirstPage();
  }, 500);
});

// Watch filters to reset to first page and reload
watch([debouncedSearch, statusFilter, typeFilter, itemsPerPage], () => {
  resetToFirstPage();
  void loadOrgs();
});

// Watch page changes to reload
watch(currentPage, () => {
  void loadOrgs();
});

onMounted(() => {
  void loadOrgs();
  void loadTotalCount();
});
</script>

<template>
  <section class="container-lg text-white py-6">
    <div class="flex flex-col gap-4 mb-4">
      <div class="flex items-center gap-3">
        <h1 class="text-3xl">Organizations</h1>
        <span class="text-lg text-white/40">({{ totalOrgsCount.toLocaleString() }})</span>
      </div>
      
      <!-- Filter Bar -->
      <div class="flex flex-wrap items-center gap-3 border-y border-white/10 bg-black/50 p-4 -mx-6">
        <!-- Show Count -->
        <div class="flex items-center gap-2">
          <span class="text-sm text-white/60">Show</span>
          <button
            v-for="count in [20, 50, 100]"
            :key="count"
            @click="itemsPerPage = count; resetToFirstPage()"
            :class="[
              'rounded px-2 py-1 text-sm transition',
              itemsPerPage === count
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            ]"
          >
            {{ count }}
          </button>
        </div>

        <!-- Divider -->
        <div class="h-6 w-px bg-white/10" />

        <!-- Status Filters -->
        <div class="flex flex-wrap items-center gap-2">
          <button
            @click="statusFilter = 'all'"
            :class="[
              'rounded px-3 py-1.5 text-sm transition',
              statusFilter === 'all'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            ]"
          >
            All
          </button>
          <button
            @click="statusFilter = 'active'"
            :class="[
              'rounded px-3 py-1.5 text-sm transition',
              statusFilter === 'active'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            ]"
          >
            Active
          </button>
          <button
            @click="statusFilter = 'inactive'"
            :class="[
              'rounded px-3 py-1.5 text-sm transition',
              statusFilter === 'inactive'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            ]"
          >
            Inactive
          </button>
        </div>

        <!-- Divider -->
        <div class="h-6 w-px bg-white/10" />

        <!-- Type Filters -->
        <div class="flex flex-wrap items-center gap-2">
          <button
            @click="typeFilter = 'all'"
            :class="[
              'rounded px-3 py-1.5 text-sm transition',
              typeFilter === 'all'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            ]"
          >
            All Types
          </button>
          <button
            @click="typeFilter = 'team'"
            :class="[
              'rounded px-3 py-1.5 text-sm transition',
              typeFilter === 'team'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            ]"
          >
            Team
          </button>
          <button
            @click="typeFilter = 'personal'"
            :class="[
              'rounded px-3 py-1.5 text-sm transition',
              typeFilter === 'personal'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            ]"
          >
            Personal
          </button>
        </div>

        <!-- Spacer -->
        <div class="flex-1" />

        <!-- Search -->
        <div class="relative w-full sm:w-64">
          <Icon icon="ph:magnifying-glass" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search organizations..."
            class="w-full rounded-lg border border-white/20 bg-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder-white/40 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
    
    <!-- Loading state -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="animate-pulse">
        <div class="flex gap-4 p-4 bg-white/5 rounded-lg">
          <div class="flex-1 space-y-3">
            <div class="h-5 bg-white/10 rounded w-2/3"></div>
            <div class="h-4 bg-white/10 rounded w-1/2"></div>
            <div class="flex gap-2">
              <div class="h-6 bg-white/10 rounded w-20"></div>
              <div class="h-6 bg-white/10 rounded w-24"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-4">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="orgs.length === 0" class="text-xs text-white/40">
      No organizations found.
    </div>

    <!-- Organizations list -->
    <div v-else class="space-y-3">
      <div
        v-for="item in orgs"
        :key="item.organization.id"
        class="w-full flex gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group relative"
      >
        <!-- Clickable card area -->
        <button
          @click="navigateToOrg(item.organization.slug)"
          class="absolute inset-0 cursor-pointer"
          aria-label="View organization"
        />

        <!-- Organization info -->
        <div class="flex-1 min-w-0 flex flex-col gap-3 relative z-10 pointer-events-none">
          <!-- Row 1: Name & type badge -->
          <div class="flex items-start gap-2">
            <Icon :icon="visibilityIcon(item.organization.visibility)" width="20" height="20" class="flex-shrink-0 text-white/50 mt-0.5" />
            <h3 class="font-semibold text-white group-hover:text-white/90 flex-1 min-w-0">
              {{ item.organization.name }}
            </h3>
            <span class="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium bg-white/10 text-white/70 rounded uppercase tracking-wide">
              {{ typeLabel(item.organization.type) }}
            </span>
          </div>

          <!-- Row 2: Metadata -->
          <div class="flex items-center gap-2 text-xs text-white/50 flex-wrap">
            <span>{{ item.member_count || 0 }} {{ item.member_count === 1 ? 'member' : 'members' }}</span>
            <span class="text-white/30">•</span>
            <span>Created {{ formatRelative(item.organization.created_at) }}</span>
            <span class="text-white/30">•</span>
            <span>{{ formatStorageRatio(item.storage_used_bytes, item.organization.storage_limit_mb) }}</span>
          </div>

          <!-- Row 3: Status & progress -->
          <div class="flex items-center gap-3 flex-wrap">
            <!-- Status badge -->
            <div
              :class="[
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border',
                statusBadgeClass(item)
              ]"
            >
              <span>{{ statusLabel(item) }}</span>
            </div>

            <!-- Storage bar -->
            <div v-if="item.storage_used_bytes && item.organization.storage_limit_mb" class="flex items-center gap-2">
              <div class="text-xs text-white/60">
                {{ getStoragePercentage(item).toFixed(0) }}% storage
              </div>
              
              <div class="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  class="h-full transition-all"
                  :class="getStoragePercentage(item) > 80 ? 'bg-red-400' : 'bg-green-400'"
                  :style="{ width: `${getStoragePercentage(item)}%` }"
                ></div>
              </div>
            </div>

            <!-- Last active -->
            <div class="text-xs text-white/50">
              Last active {{ formatRelative(item.last_activity_at) }}
            </div>
          </div>
        </div>

        <!-- Three dots menu -->
        <div class="flex-shrink-0 flex items-center relative z-20">
          <Menu as="div" class="relative">
            <MenuButton 
              class="pointer-events-auto flex items-center justify-center w-8 h-8 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white/70"
              @click.stop
            >
              <Icon icon="carbon:overflow-menu-vertical" width="20" />
            </MenuButton>

            <transition
              enter-active-class="transition duration-100 ease-out"
              enter-from-class="transform scale-95 opacity-0"
              enter-to-class="transform scale-100 opacity-100"
              leave-active-class="transition duration-75 ease-in"
              leave-from-class="transform scale-100 opacity-100"
              leave-to-class="transform scale-95 opacity-0"
            >
              <MenuItems 
                class="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-gray-900 border border-white/20 shadow-lg focus:outline-none z-50"
              >
                <div class="py-1">
                  <MenuItem v-slot="{ active }">
                    <button
                      @click="openEditModal(item)"
                      :class="[
                        active ? 'bg-white/10 text-white' : 'text-white/70',
                        'group flex w-full items-center gap-2 px-4 py-2 text-sm'
                      ]"
                    >
                      <Icon icon="carbon:edit" width="16" />
                      Edit
                    </button>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                    <button
                      @click="openDeleteModal(item)"
                      :class="[
                        active ? 'bg-red-500/10 text-red-400' : 'text-red-400/70',
                        'group flex w-full items-center gap-2 px-4 py-2 text-sm'
                      ]"
                    >
                      <Icon icon="carbon:trash-can" width="16" />
                      Delete
                    </button>
                  </MenuItem>
                </div>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 mt-6">
      <button
        type="button"
        @click="prevPage"
        :disabled="currentPage === 1"
        class="rounded px-3 py-1.5 text-sm transition"
        :class="currentPage === 1 ? 'text-white/30 cursor-not-allowed' : 'text-white/70 hover:bg-white/10'"
      >
        <Icon icon="carbon:chevron-left" class="h-4 w-4" />
      </button>

      <template v-for="(page, idx) in visiblePageNumbers" :key="idx">
        <span v-if="page === '...'" class="px-2 text-white/40">...</span>
        <button
          v-else
          type="button"
          @click="goToPage(page as number)"
          class="rounded px-3 py-1.5 text-sm transition"
          :class="currentPage === page ? 'bg-white/20 font-semibold text-white' : 'text-white/70 hover:bg-white/10'"
        >
          {{ page }}
        </button>
      </template>

      <button
        type="button"
        @click="nextPage"
        :disabled="currentPage === totalPages"
        class="rounded px-3 py-1.5 text-sm transition"
        :class="currentPage === totalPages ? 'text-white/30 cursor-not-allowed' : 'text-white/70 hover:bg-white/10'"
      >
        <Icon icon="carbon:chevron-right" class="h-4 w-4" />
      </button>
    </div>

    <!-- Edit Organization Modal -->
    <EditOrgModal
      v-if="showEditModal && orgToEdit"
      :organization="orgToEdit"
      @close="closeEditModal"
      @submit="handleEditSubmit"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmDeleteModal
      v-if="showDeleteModal && orgToDelete"
      :show="showDeleteModal"
      :item-name="orgToDelete.name"
      popup-title="Delete Organization"
      :is-deleting="isDeleting"
      :error="deleteError"
      @confirm="confirmDelete"
      @cancel="closeDeleteModal"
      @close="closeDeleteModal"
    />
  </section>
</template>

<style scoped>

</style>


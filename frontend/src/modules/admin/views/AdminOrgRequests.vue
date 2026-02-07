<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onMounted, ref, watch } from "vue";
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { orgService } from "@/modules/orgs/services/orgServiceV2";
import { toast } from "@/lib/toast";
import ConfirmApproveModal from '@/modules/admin/components/ConfirmApproveModal.vue';
import RejectRequestModal from '@/modules/admin/components/RejectRequestModal.vue';
import RequestDetailsModal from '@/modules/admin/components/RequestDetailsModal.vue';
import type {
  OrgRequestAdminView,
  OrganizationRequestStatus,
} from "@/modules/orgs/types";

const requests = ref<OrgRequestAdminView[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Filter and pagination state
const searchQuery = ref('');
const debouncedSearch = ref('');
const searchDebounceTimer = ref<NodeJS.Timeout | null>(null);
const statusFilter = ref<'all' | OrganizationRequestStatus>('pending');
const typeFilter = ref<'all' | 'team' | 'personal'>('all');
const itemsPerPage = ref(20);
const currentPage = ref(1);
const totalCount = ref(0);
const totalRequestsCount = ref(0);

// Modal states
const showApproveModal = ref(false);
const showRejectModal = ref(false);
const showDetailsModal = ref(false);
const selectedRequest = ref<OrgRequestAdminView | null>(null);
const isApproving = ref(false);
const isRejecting = ref(false);

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

const filteredRequests = computed(() => {
  let filtered = [...requests.value];
  
  // Client-side type filtering
  if (typeFilter.value !== 'all') {
    filtered = filtered.filter(req => req.requested_type === typeFilter.value);
  }
  
  return filtered;
});

const paginatedRequests = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredRequests.value.slice(start, end);
});

const loadRequests = async () => {
  loading.value = true;
  error.value = null;
  try {
    const filters: any = {};
    
    if (debouncedSearch.value.trim()) {
      filters.search = debouncedSearch.value.trim();
    }
    
    if (statusFilter.value !== 'all') {
      filters.status = statusFilter.value;
    }
    
    requests.value = await orgService.listOrgRequests(filters);
    totalCount.value = filteredRequests.value.length;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load organization requests.";
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
    const allRequests = await orgService.listOrgRequests({});
    totalRequestsCount.value = allRequests.length;
  } catch (err) {
    console.error('Failed to load total request count:', err);
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

const typeLabel = (value: string | null | undefined) => {
  const normalized = (value || "").toLowerCase();
  if (normalized === "team" || normalized === "organization") return "Team";
  if (normalized === "personal" || normalized === "individual") return "Personal";
  return "Unknown";
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "approved":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "rejected":
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    case "contacted":
      return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    default:
      return "bg-white/5 text-white/70 border-white/20";
  }
};

const profileLabel = (
  profile?: { id?: string | null; name?: string | null; username?: string | null } | null,
  fallbackId?: string | null
) => {
  const name = profile?.name?.trim() || profile?.username?.trim();
  if (name) return name;
  if (profile?.id) return `User ${profile.id.slice(0, 8)}...`;
  if (fallbackId) return `User ${fallbackId.slice(0, 8)}...`;
  return "Unknown";
};

const reviewedSummary = (request: OrgRequestAdminView) => {
  const when = request.reviewed_at ? formatRelative(request.reviewed_at) : null;
  const who = request.reviewed_by || request.reviewer ? profileLabel(request.reviewer, request.reviewed_by) : null;
  if (when && who) return `Reviewed ${when} by ${who}`;
  if (when) return `Reviewed ${when}`;
  if (who) return `Reviewed by ${who}`;
  return "Reviewed";
};

// Modal actions
const openApproveModal = (request: OrgRequestAdminView) => {
  selectedRequest.value = request;
  showApproveModal.value = true;
};

const closeApproveModal = () => {
  if (isApproving.value) return;
  showApproveModal.value = false;
  selectedRequest.value = null;
};

const confirmApprove = async () => {
  if (!selectedRequest.value) return;
  
  isApproving.value = true;
  try {
    await orgService.approveAndCreateOrg(selectedRequest.value.id);
    toast({
      variant: "success",
      message: `Approved ${selectedRequest.value.requested_name}.`,
    });
    closeApproveModal();
    await loadRequests();
    await loadTotalCount();
  } catch (err) {
    toast({
      variant: "error",
      message: err instanceof Error ? err.message : "Failed to approve request.",
    });
  } finally {
    isApproving.value = false;
  }
};

const openRejectModal = (request: OrgRequestAdminView) => {
  selectedRequest.value = request;
  showRejectModal.value = true;
};

const closeRejectModal = () => {
  if (isRejecting.value) return;
  showRejectModal.value = false;
  selectedRequest.value = null;
};

const confirmReject = async (reason: string) => {
  if (!selectedRequest.value) return;
  
  isRejecting.value = true;
  try {
    await orgService.rejectOrgRequest(selectedRequest.value.id, reason);
    toast({
      variant: "success",
      message: `Rejected ${selectedRequest.value.requested_name}.`,
    });
    closeRejectModal();
    await loadRequests();
    await loadTotalCount();
  } catch (err) {
    toast({
      variant: "error",
      message: err instanceof Error ? err.message : "Failed to reject request.",
    });
  } finally {
    isRejecting.value = false;
  }
};

const openDetailsModal = (request: OrgRequestAdminView) => {
  selectedRequest.value = request;
  showDetailsModal.value = true;
};

const closeDetailsModal = () => {
  showDetailsModal.value = false;
  selectedRequest.value = null;
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
watch([debouncedSearch, statusFilter, typeFilter, itemsPerPage], () => {
  resetToFirstPage();
  void loadRequests();
});

// Watch filtered results to update total count
watch(filteredRequests, (newFiltered) => {
  totalCount.value = newFiltered.length;
});

onMounted(() => {
  void loadRequests();
  void loadTotalCount();
});
</script>

<template>
  <section class="container-lg text-white py-6">
    <div class="flex flex-col gap-4 mb-4">
      <div class="flex items-center gap-3">
        <h1 class="text-3xl">Organization Requests</h1>
        <span class="text-lg text-white/40">({{ totalRequestsCount.toLocaleString() }})</span>
      </div>
      
      <!-- Filter Bar -->
      <div class="flex flex-col gap-3 text-sm mb-6">
        <!-- First Row: Show Count and Status/Type Filters -->
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

          <!-- Status Filters -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="statusFilter = 'all'"
              class="transition px-2 py-0.5 rounded"
              :class="statusFilter === 'all' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              All
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="statusFilter = 'pending'"
              class="transition px-2 py-0.5 rounded"
              :class="statusFilter === 'pending' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              Pending
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="statusFilter = 'approved'"
              class="transition px-2 py-0.5 rounded"
              :class="statusFilter === 'approved' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              Approved
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="statusFilter = 'rejected'"
              class="transition px-2 py-0.5 rounded"
              :class="statusFilter === 'rejected' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              Rejected
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="statusFilter = 'contacted'"
              class="transition px-2 py-0.5 rounded"
              :class="statusFilter === 'contacted' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              Contacted
            </button>
          </div>

          <!-- Type Filters -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="typeFilter = 'all'"
              class="transition px-2 py-0.5 rounded"
              :class="typeFilter === 'all' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              All Types
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="typeFilter = 'team'"
              class="transition px-2 py-0.5 rounded"
              :class="typeFilter === 'team' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              Team
            </button>
            <div class="h-4 w-px bg-white/20"></div>
            <button
              type="button"
              @click="typeFilter = 'personal'"
              class="transition px-2 py-0.5 rounded"
              :class="typeFilter === 'personal' ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
            >
              Personal
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
              placeholder="Search by name..."
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
      <p class="font-semibold">Unable to load organization requests.</p>
      <p class="mt-2 text-sm text-white/80">{{ error }}</p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="paginatedRequests.length === 0"
      class="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-white/70"
    >
      No organization requests found.
    </div>

    <!-- Request Cards -->
    <div v-else class="space-y-3">
      <div
        v-for="request in paginatedRequests"
        :key="request.id"
        class="relative group rounded-lg border border-white/10 bg-white/5 transition cursor-pointer hover:bg-white/10"
        @click="openDetailsModal(request)"
      >
        <div class="p-5">
          <!-- Top Row: Name, Type, Status, Menu -->
          <div class="flex items-start justify-between gap-4 mb-3">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <h3 class="text-lg font-semibold text-white truncate">
                {{ request.requested_name }}
              </h3>
              <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white/70 border-white/20 bg-black/30 shrink-0">
                {{ typeLabel(request.requested_type) }}
              </span>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <span
                class="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                :class="statusBadgeClass(request.status)"
              >
                {{ request.status }}
              </span>

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
                    <MenuItem v-if="request.status === 'pending'" v-slot="{ active }">
                      <button
                        @click.stop="openApproveModal(request)"
                        class="w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2"
                        :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                      >
                        <Icon icon="carbon:checkmark" class="h-4 w-4" />
                        Approve
                      </button>
                    </MenuItem>
                    <MenuItem v-if="request.status === 'pending'" v-slot="{ active }">
                      <button
                        @click.stop="openRejectModal(request)"
                        class="w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2"
                        :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                      >
                        <Icon icon="carbon:close" class="h-4 w-4" />
                        Reject with Reason
                      </button>
                    </MenuItem>
                    <MenuItem v-slot="{ active }">
                      <button
                        @click.stop="openDetailsModal(request)"
                        class="w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-2"
                        :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                      >
                        <Icon icon="carbon:information" class="h-4 w-4" />
                        View Details
                      </button>
                    </MenuItem>
                  </MenuItems>
                </transition>
              </Menu>
            </div>
          </div>

          <!-- Second Row: Requester and Time -->
          <div class="flex items-center gap-2 text-sm text-white/60 mb-2">
            <span class="text-white/70">{{ profileLabel(request.requester, request.requester_id) }}</span>
            <span class="text-white/30">•</span>
            <span>Requested {{ formatRelative(request.created_at) }}</span>
          </div>

          <!-- Message -->
          <p v-if="request.message" class="text-sm text-white/60 line-clamp-2 mb-2">
            {{ request.message }}
          </p>

          <!-- Review Summary (for reviewed requests) -->
          <div v-if="request.status !== 'pending'" class="text-xs text-white/45 italic">
            {{ reviewedSummary(request) }}
            <span v-if="request.review_notes" class="ml-2">— {{ request.review_notes }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="!loading && paginatedRequests.length > 0 && totalPages > 1" class="flex items-center justify-center gap-2 mt-6">
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
    <ConfirmApproveModal
      :show="showApproveModal"
      :request-name="selectedRequest?.requested_name || ''"
      :requester-name="profileLabel(selectedRequest?.requester, selectedRequest?.requester_id)"
      :loading="isApproving"
      @close="closeApproveModal"
      @confirm="confirmApprove"
    />

    <RejectRequestModal
      :show="showRejectModal"
      :request-name="selectedRequest?.requested_name || ''"
      :requester-name="profileLabel(selectedRequest?.requester, selectedRequest?.requester_id)"
      :loading="isRejecting"
      @close="closeRejectModal"
      @confirm="confirmReject"
    />

    <RequestDetailsModal
      :show="showDetailsModal"
      :request="selectedRequest"
      @close="closeDetailsModal"
    />
  </section>
</template>

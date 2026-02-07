<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onMounted, ref, watch } from "vue";
import { orgService } from "@/modules/orgs/services/orgServiceV2";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import BillingDetailsModal from '@/modules/admin/components/BillingDetailsModal.vue';
import type { BillingItem } from "@/modules/admin/types/BillingItem";
import type { OrganizationAdminListItem } from "@/modules/orgs/types";

const billingItems = ref<BillingItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const loadingNarrations = ref(false);
let narrationLoadAbortController: AbortController | null = null;

// Filter and pagination state
const searchQuery = ref('');
const debouncedSearch = ref('');
const searchDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const statusFilter = ref<'all' | 'active' | 'inactive'>('all');
const itemsPerPage = ref(20);
const currentPage = ref(1);
const totalCount = ref(0);
const totalOrgsCount = ref(0);
const totalMonthlyRevenue = ref(0);
const totalNarrations = ref(0);

// Modal states
const showDetailsModal = ref(false);
const selectedBilling = ref<BillingItem | null>(null);

const MONTHLY_PRICE_PER_ORG = 35.00;

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

const filteredBillingItems = computed(() => {
  let filtered = [...billingItems.value];
  
  if (statusFilter.value === 'active') {
    filtered = filtered.filter(item => isActive(item));
  } else if (statusFilter.value === 'inactive') {
    filtered = filtered.filter(item => !isActive(item));
  }
  
  return filtered;
});

const paginatedBillingItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredBillingItems.value.slice(start, end);
});

const isActive = (item: BillingItem) => {
  if (!item.last_activity_at) return false;
  const daysSinceActivity = Math.floor(
    (Date.now() - new Date(item.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysSinceActivity < 30;
};

const statusBadgeClass = (item: BillingItem) => {
  return isActive(item)
    ? "bg-green-500/10 text-green-400 border-green-500/20"
    : "bg-gray-500/10 text-gray-400 border-gray-500/20";
};

const statusLabel = (item: BillingItem) => {
  return isActive(item) ? "Active" : "Inactive";
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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const getCurrentMonthLabel = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now);
};

const loadOrganizations = async () => {
  loading.value = true;
  error.value = null;
  try {
    // Build filters
    const filters: any = {
      limit: 9999,
      offset: 0,
    };
    
    if (debouncedSearch.value.trim()) {
      filters.search = debouncedSearch.value.trim();
    }
    
    const orgs = await orgService.listOrganizations(filters);
    
    // Create billing items with loading state for narration counts
    billingItems.value = orgs.map((org: OrganizationAdminListItem) => ({
      organization: org.organization,
      member_count: org.member_count || 0,
      narration_count: null, // Will be loaded separately
      loading_narrations: true,
      narration_error: null,
      storage_used_bytes: org.storage_used_bytes || 0,
      monthly_revenue: MONTHLY_PRICE_PER_ORG,
      created_at: org.organization.created_at,
      last_activity_at: org.last_activity_at || null,
    } as BillingItem));
    
    // Calculate initial totals
    totalOrgsCount.value = billingItems.value.length;
    totalMonthlyRevenue.value = billingItems.value.length * MONTHLY_PRICE_PER_ORG;
    totalNarrations.value = 0; // Will be calculated as counts load
    
    // Update filtered count
    totalCount.value = filteredBillingItems.value.length;
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

const loadNarrationCounts = async () => {
  // Cancel any existing narration load
  if (narrationLoadAbortController) {
    narrationLoadAbortController.abort();
  }
  
  narrationLoadAbortController = new AbortController();
  loadingNarrations.value = true;
  
  try {
    // Get current month date range
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    // Load narration counts in parallel for all orgs (filtered by current month)
    const promises = billingItems.value.map(async (item, index) => {
      try {
        const { count, error: countError } = await supabase
          .from('narrations')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', item.organization.id)
          .gte('created_at', firstDayOfMonth.toISOString())
          .lt('created_at', firstDayOfNextMonth.toISOString());
        
        if (countError) throw countError;
        
        // Check if this operation was aborted
        if (narrationLoadAbortController?.signal.aborted) {
          return;
        }
        
        // Update the specific item
        billingItems.value[index] = {
          ...item,
          narration_count: count || 0,
          loading_narrations: false,
          narration_error: null,
        };
        
        // Update total narrations
        totalNarrations.value = billingItems.value.reduce((sum, bi) => 
          sum + (bi.narration_count || 0), 0
        );
      } catch (err) {
        if (narrationLoadAbortController?.signal.aborted) {
          return;
        }
        
        console.error(`Failed to get narrations for org ${item.organization.id}:`, err);
        billingItems.value[index] = {
          ...item,
          narration_count: 0,
          loading_narrations: false,
          narration_error: err instanceof Error ? err.message : 'Failed to load',
        };
      }
    });
    
    await Promise.all(promises);
  } finally {
    loadingNarrations.value = false;
  }
};

const loadBillingData = async () => {
  await loadOrganizations();
  // Load narration counts in background (non-blocking)
  void loadNarrationCounts();
};

const openDetailsModal = (item: BillingItem) => {
  selectedBilling.value = item;
  showDetailsModal.value = true;
};

const closeDetailsModal = () => {
  showDetailsModal.value = false;
  selectedBilling.value = null;
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
watch([debouncedSearch, statusFilter, itemsPerPage], () => {
  resetToFirstPage();
  void loadBillingData();
});

// Watch filtered results to update total count
watch(filteredBillingItems, (newFiltered) => {
  totalCount.value = newFiltered.length;
});

onMounted(() => {
  void loadBillingData();
});
</script>

<template>
  <section class="container-lg text-white py-6">
    <div class="flex flex-col gap-4 mb-4">
      <!-- Header with Summary -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <h1 class="text-3xl">Billing & Revenue</h1>
            <span class="text-sm text-white/50 px-2.5 py-1 rounded-full bg-white/10 border border-white/20">
              {{ getCurrentMonthLabel() }}
            </span>
          </div>
          <div class="flex items-center gap-4 text-sm text-white/60">
            <span>{{ totalOrgsCount }} organizations</span>
            <span class="text-white/30">•</span>
            <span v-if="billingItems.some(b => b.loading_narrations)" class="inline-flex items-center gap-1">
              <span class="animate-pulse bg-white/20 rounded h-3 w-12"></span>
              <span>monthly narrations</span>
            </span>
            <span v-else>{{ totalNarrations.toLocaleString() }} monthly narrations</span>
            <span class="text-white/30">•</span>
            <span v-if="billingItems.some(b => b.loading_narrations)" class="inline-flex items-center gap-1">
              ~<span class="animate-pulse bg-white/20 rounded h-3 w-12"></span>
              <span>API calls this month</span>
            </span>
            <span v-else>~{{ (totalNarrations * 2).toLocaleString() }} API calls this month</span>
          </div>
        </div>
        
        <!-- Revenue Card -->
        <div class="rounded-lg border border-green-500/20 bg-green-500/5 p-4 min-w-[200px]">
          <div class="text-xs text-green-400/80 font-medium uppercase tracking-wide mb-1">
            Monthly Revenue
          </div>
          <div class="text-2xl font-bold text-green-400">
            {{ formatCurrency(totalMonthlyRevenue) }}
          </div>
          <div class="text-xs text-white/40 mt-1">
            ${{ MONTHLY_PRICE_PER_ORG.toFixed(2) }} per org
          </div>
        </div>
      </div>
      
      <!-- Filter Bar -->
      <div class="flex flex-wrap items-center gap-3 border-y border-white/10 bg-black/50 p-4">
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
    <div v-else-if="paginatedBillingItems.length === 0" class="text-xs text-white/40">
      No billing records found.
    </div>

    <!-- Billing list -->
    <div v-else class="space-y-3">
      <div
        v-for="item in paginatedBillingItems"
        :key="item.organization.id"
        class="w-full flex gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group cursor-pointer"
        @click="openDetailsModal(item)"
      >
        <!-- Organization info -->
        <div class="flex-1 min-w-0 flex flex-col gap-3">
          <!-- Row 1: Name & Revenue -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <Icon icon="carbon:building" width="20" height="20" class="flex-shrink-0 text-white/50" />
              <h3 class="font-semibold text-white group-hover:text-white/90">
                {{ item.organization.name }}
              </h3>
            </div>
            <span class="flex-shrink-0 text-lg font-semibold text-green-400">
              {{ formatCurrency(item.monthly_revenue) }}<span class="text-xs text-white/60">/mo</span>
            </span>
          </div>

          <!-- Row 2: Metadata -->
          <div class="flex items-center gap-3 text-xs text-white/50 flex-wrap">
            <span class="flex items-center gap-1">
              <Icon icon="carbon:user-multiple" class="h-3.5 w-3.5" />
              {{ item.member_count }} {{ item.member_count === 1 ? 'member' : 'members' }}
            </span>
            <span class="text-white/30">•</span>
            
            <!-- Narration count with loading shimmer -->
            <span class="flex items-center gap-1">
              <Icon icon="carbon:microphone" class="h-3.5 w-3.5" />
              <span v-if="item.loading_narrations" class="inline-flex items-center gap-1">
                <span class="animate-pulse bg-white/20 rounded h-3 w-8"></span>
                <span>this month</span>
              </span>
              <span v-else-if="item.narration_error" class="text-red-400/70" :title="item.narration_error">
                Error loading
              </span>
              <span v-else>
                {{ (item.narration_count || 0).toLocaleString() }} this month
              </span>
            </span>
            <span class="text-white/30">•</span>
            
            <!-- API calls with loading shimmer -->
            <span class="flex items-center gap-1 text-blue-400/70">
              <Icon icon="carbon:data-1" class="h-3.5 w-3.5" />
              <span v-if="item.loading_narrations" class="inline-flex items-center gap-1">
                ~<span class="animate-pulse bg-blue-400/20 rounded h-3 w-8"></span>
                <span>API calls</span>
              </span>
              <span v-else>
                ~{{ ((item.narration_count || 0) * 2).toLocaleString() }} API calls
              </span>
            </span>
          </div>

          <!-- Row 3: Status & Activity -->
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

            <!-- Last active -->
            <div class="text-xs text-white/50">
              Last active {{ formatRelative(item.last_activity_at) }}
            </div>
            
            <!-- Created -->
            <div class="text-xs text-white/40">
              Created {{ formatRelative(item.created_at) }}
            </div>
          </div>
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

    <!-- Details Modal -->
    <BillingDetailsModal
      :show="showDetailsModal"
      :billing="selectedBilling"
      @close="closeDetailsModal"
    />
  </section>
</template>

<style scoped>

</style>


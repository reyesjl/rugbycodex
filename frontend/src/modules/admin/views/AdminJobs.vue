<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { jobService } from '@/modules/jobs/services/jobService';
import type { AdminJobListItem } from '@/modules/orgs/types/AdminJobListItem';
import type { JobState } from '@/modules/orgs/types/JobState';
import type { JobType } from '@/modules/orgs/types/JobType';
import JobDetailsModal from '@/modules/admin/components/JobDetailsModal.vue';

// Filter state
const showCount = ref<20 | 50 | 100>(20);
const stateFilter = ref<JobState | 'all'>('all');
const typeFilter = ref<JobType | 'all'>('all');
const searchQuery = ref('');
const debouncedSearch = ref('');

// Valid show counts
const counts = [20, 50, 100] as const;

// Pagination
const currentPage = ref(1);

// Data
const jobs = ref<AdminJobListItem[]>([]);
const totalCount = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);

// Modal state
const viewingJob = ref<AdminJobListItem | null>(null);

// Debounce search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    debouncedSearch.value = newValue;
  }, 500);
});

// Reset to page 1 when filters change
watch([debouncedSearch, stateFilter, typeFilter, showCount], () => {
  currentPage.value = 1;
});

// Load data when filters change
watch([debouncedSearch, stateFilter, typeFilter], () => {
  loadJobs();
});

// Computed
const filteredJobs = computed(() => {
  return jobs.value;
});

const paginatedJobs = computed(() => {
  const start = (currentPage.value - 1) * showCount.value;
  const end = start + showCount.value;
  return filteredJobs.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(filteredJobs.value.length / showCount.value);
});

const hasJobs = computed(() => jobs.value.length > 0);

// Actions
async function loadJobs() {
  loading.value = true;
  error.value = null;

  try {
    const filters = {
      searchQuery: debouncedSearch.value || undefined,
      state: stateFilter.value === 'all' ? null : stateFilter.value,
      type: typeFilter.value === 'all' ? null : typeFilter.value,
    };

    jobs.value = await jobService.listAllJobs(filters);
    totalCount.value = jobs.value.length;
  } catch (err) {
    console.error('Failed to load jobs:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load jobs';
  } finally {
    loading.value = false;
  }
}

async function loadTotalCount() {
  try {
    const allJobs = await jobService.listAllJobs();
    totalCount.value = allJobs.length;
  } catch (err) {
    console.error('Failed to load total count:', err);
  }
}

function handleViewDetails(job: AdminJobListItem) {
  viewingJob.value = job;
}

function closeDetailsModal() {
  viewingJob.value = null;
}

function getStateBadgeColor(state: string): string {
  switch (state) {
    case 'queued': return 'bg-gray-500/20 text-gray-400';
    case 'running': return 'bg-blue-500/20 text-blue-400';
    case 'succeeded': return 'bg-green-500/20 text-green-400';
    case 'failed': return 'bg-rose-500/20 text-rose-400';
    case 'canceled': return 'bg-orange-500/20 text-orange-400';
    default: return 'bg-white/10 text-white/60';
  }
}

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'transcoding': return 'bg-purple-500/20 text-purple-400';
    default: return 'bg-white/10 text-white/60';
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDuration(startDate: Date, endDate: Date | null): string {
  const end = endDate || new Date();
  const diffMs = end.getTime() - startDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  
  if (diffSecs < 60) return `${diffSecs}s`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m`;
  const hours = Math.floor(diffSecs / 3600);
  const minutes = Math.floor((diffSecs % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
}

// Initialize
onMounted(() => {
  loadTotalCount();
  loadJobs();
});
</script>

<template>
  <section class="container-lg text-white py-6">
    <div class="flex flex-col gap-4 mb-4">
      <div class="flex items-center gap-3">
        <h1 class="text-3xl">Jobs</h1>
        <span class="text-lg text-white/40">({{ totalCount.toLocaleString() }})</span>
      </div>

      <!-- Filter Bar -->
      <div class="flex flex-wrap items-center gap-3 border-y border-white/10 bg-black/50 p-4">
        <!-- Show Count -->
        <span class="text-sm text-white/60">Show</span>
        <div class="flex gap-1">
          <button
            v-for="count in [20, 50, 100]"
            :key="count"
            @click="showCount = count"
            :class="[
              'rounded px-2 py-1 text-sm transition',
              showCount === count
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            ]"
          >
            {{ count }}
          </button>
        </div>

        <!-- Divider -->
        <div class="h-6 w-px bg-white/10" />

        <!-- State Filters -->
        <div class="flex flex-wrap items-center gap-2">
          <button
            @click="stateFilter = 'all'"
            :class="[
              'rounded px-3 py-1.5 text-sm transition',
              stateFilter === 'all'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            ]"
          >
            All
          </button>
          <button
            v-for="state in ['queued', 'running', 'succeeded', 'failed', 'canceled']"
            :key="state"
            @click="stateFilter = state as JobState"
            :class="[
              'rounded px-3 py-1.5 text-sm transition capitalize',
              stateFilter === state
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            ]"
          >
            {{ state }}
          </button>
        </div>

        <!-- Spacer -->
        <div class="flex-1" />

        <!-- Search -->
        <div class="relative w-full sm:w-64">
          <Icon 
            icon="ph:magnifying-glass" 
            class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by org or creator..."
            class="w-full rounded-lg border border-white/20 bg-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder-white/40 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/40"
          />
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="text-white/60">Loading jobs...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center py-12">
      <div class="text-rose-400">{{ error }}</div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!hasJobs" class="flex flex-col items-center justify-center py-12">
      <Icon icon="ph:briefcase" class="h-16 w-16 text-white/20 mb-4" />
      <p class="text-white/60">No jobs found</p>
    </div>

    <!-- Jobs List -->
    <div v-else class="space-y-3">
      <div
        v-for="job in paginatedJobs"
        :key="job.id"
        class="group relative rounded-lg border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10 cursor-pointer overflow-visible"
        @click="handleViewDetails(job)"
      >
        <div class="flex items-start justify-between gap-4">
          <!-- Left: Job Info -->
          <div class="flex-1 min-w-0 space-y-3">
            <!-- Type and State -->
            <div class="flex items-center gap-2 flex-wrap">
              <span :class="['inline-flex px-2 py-1 text-xs font-medium rounded capitalize', getTypeBadgeColor(job.type)]">
                {{ job.type }}
              </span>
              <span :class="['inline-flex px-2 py-1 text-xs font-medium rounded capitalize', getStateBadgeColor(job.state)]">
                {{ job.state }}
              </span>
              <span v-if="job.attempt > 1" class="inline-flex px-2 py-1 text-xs font-medium rounded bg-orange-500/20 text-orange-400">
                Retry #{{ job.attempt }}
              </span>
              <span v-if="job.state === 'failed'" class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-rose-500/20 text-rose-400">
                <Icon icon="ph:warning" class="h-3 w-3" />
                Error
              </span>
            </div>

            <!-- Progress Bar (for running jobs) -->
            <div v-if="job.state === 'running'" class="space-y-1">
              <div class="flex items-center justify-between text-xs text-white/60">
                <span>Progress</span>
                <span>{{ Math.round(job.progress * 100) }}%</span>
              </div>
              <div class="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div 
                  class="bg-blue-500 h-full transition-all duration-300"
                  :style="{ width: `${job.progress * 100}%` }"
                />
              </div>
            </div>

            <!-- Organization -->
            <div class="flex items-center gap-2 text-sm text-white/60">
              <Icon icon="ph:buildings" class="h-4 w-4 flex-shrink-0" />
              <span>{{ job.org_name || 'Unknown Organization' }}</span>
            </div>

            <!-- Creator -->
            <div v-if="job.creator_name || job.creator_username" class="flex items-center gap-2 text-sm text-white/60">
              <Icon icon="ph:user" class="h-4 w-4 flex-shrink-0" />
              <span>
                {{ job.creator_name || 'Unknown' }}
                <span v-if="job.creator_username" class="text-white/40">(@{{ job.creator_username }})</span>
              </span>
            </div>

            <!-- Timestamps -->
            <div class="flex items-center gap-4 text-xs text-white/40">
              <div class="flex items-center gap-1">
                <Icon icon="ph:clock" class="h-3 w-3" />
                <span>{{ formatDate(job.created_at) }}</span>
              </div>
              <div v-if="job.started_at" class="flex items-center gap-1">
                <Icon icon="ph:timer" class="h-3 w-3" />
                <span>{{ formatDuration(job.started_at, job.finished_at) }}</span>
              </div>
            </div>
          </div>

          <!-- Right: Icon -->
          <div class="flex-shrink-0">
            <Icon 
              icon="ph:chevron-right" 
              class="h-5 w-5 text-white/20 group-hover:text-white/40 transition"
            />
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between border-t border-white/10 pt-4 mt-6">
        <div class="text-sm text-white/60">
          Showing {{ (currentPage - 1) * showCount + 1 }} to {{ Math.min(currentPage * showCount, filteredJobs.length) }} of {{ filteredJobs.length }} jobs
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            :class="[
              'rounded px-3 py-1.5 text-sm transition',
              currentPage === 1
                ? 'text-white/20 cursor-not-allowed'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            ]"
          >
            Previous
          </button>
          <div class="flex items-center gap-1">
            <template v-for="page in totalPages" :key="page">
              <button
                v-if="page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)"
                @click="goToPage(page)"
                :class="[
                  'rounded px-3 py-1.5 text-sm transition',
                  page === currentPage
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                ]"
              >
                {{ page }}
              </button>
              <span 
                v-else-if="page === currentPage - 2 || page === currentPage + 2"
                class="text-white/40 px-2"
              >
                ...
              </span>
            </template>
          </div>
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            :class="[
              'rounded px-3 py-1.5 text-sm transition',
              currentPage === totalPages
                ? 'text-white/20 cursor-not-allowed'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            ]"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Job Details Modal -->
    <JobDetailsModal
      v-if="viewingJob"
      :job="viewingJob"
      @close="closeDetailsModal"
    />
  </section>
</template>

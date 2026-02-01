<script setup lang="ts">
import { onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useManagerAssignments } from '@/modules/app/composables/useManagerAssignments';
import type { AssignmentStatus } from '@/modules/app/composables/useManagerAssignments';

const router = useRouter();

const {
  assignments,
  loading,
  error,
  isEmpty,
  isFilteredEmpty,
  selectedStatus,
  selectedLimit,
  loadAssignments,
  getCompletionRate,
  getCompletionPercentage,
  getStatusBadge,
  formatDueDate,
  getAssignmentTarget,
  formatRelativeDate,
} = useManagerAssignments();

onMounted(() => {
  loadAssignments();
});

// Reload assignments when limit changes
watch(selectedLimit, () => {
  loadAssignments();
});

// Get empty state message based on selected filter
const emptyStateMessage = computed(() => {
  switch (selectedStatus.value) {
    case 'active':
      return 'No active assignments. All assignments have been started or completed.';
    case 'in_progress':
      return 'No assignments in progress. Check "Active" or "Recently Done" tabs.';
    case 'recently_done':
      return 'No assignments completed in the last 7 days.';
    case 'all':
    default:
      return 'No assignments created yet. Create assignments to start tracking team learning.';
  }
});

const filteredEmptyMessage = computed(() => {
  switch (selectedStatus.value) {
    case 'active':
      return 'No active assignments found.';
    case 'in_progress':
      return 'No assignments in progress found.';
    case 'recently_done':
      return 'No assignments completed in the last 7 days.';
    default:
      return 'No assignments found for this filter.';
  }
});

const navigateToAssignment = (orgSlug: string) => {
  // For now, navigate to org page - can be updated to assignment detail page later
  router.push({
    name: 'OrgOverview',
    params: { slug: orgSlug },
  });
};

const setStatus = (status: AssignmentStatus) => {
  selectedStatus.value = status;
};
</script>

<template>
  <section class="container-lg text-white py-20">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
      <div class="text-2xl font-semibold">Your assignments</div>
      
      <div class="flex items-center gap-6">
        <!-- Limit selector -->
        <div class="flex items-center gap-2 text-sm">
          <span class="text-white/50">Show</span>
          <button
            type="button"
            @click="selectedLimit = 5"
            class="transition px-2 py-0.5 rounded"
            :class="selectedLimit === 5 ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
          >
            5
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="selectedLimit = 10"
            class="transition px-2 py-0.5 rounded"
            :class="selectedLimit === 10 ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
          >
            10
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="selectedLimit = 20"
            class="transition px-2 py-0.5 rounded"
            :class="selectedLimit === 20 ? 'text-white font-semibold bg-white/10' : 'text-white/40 hover:text-white/60'"
          >
            20
          </button>
        </div>

        <!-- Status filter toggle -->
        <div class="flex items-center gap-3 text-sm">
          <button
            type="button"
            @click="setStatus('all')"
            class="transition"
            :class="selectedStatus === 'all' ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'"
          >
            All
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="setStatus('active')"
            class="transition"
            :class="selectedStatus === 'active' ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'"
          >
            Active
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="setStatus('in_progress')"
            class="transition"
            :class="selectedStatus === 'in_progress' ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'"
          >
            In Progress
          </button>
          <div class="h-4 w-px bg-white/20"></div>
          <button
            type="button"
            @click="setStatus('recently_done')"
            class="transition"
            :class="selectedStatus === 'recently_done' ? 'text-white font-semibold' : 'text-white/40 hover:text-white/60'"
          >
            Recently Done
          </button>
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

    <!-- Empty state (no assignments at all) -->
    <div v-else-if="isEmpty" class="text-xs text-white/40">
      {{ emptyStateMessage }}
    </div>

    <!-- Filtered empty state (assignments exist but filter returns none) -->
    <div v-else-if="isFilteredEmpty" class="text-xs text-white/40">
      <p>{{ filteredEmptyMessage }}</p>
      <p class="mt-2">Try selecting a different filter to see your assignments.</p>
    </div>

    <!-- Assignments list -->
    <div v-else class="space-y-3">
      <button
        v-for="assignment in assignments"
        :key="assignment.id"
        @click="navigateToAssignment(assignment.orgSlug)"
        class="w-full flex gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group cursor-pointer text-left"
      >
        <!-- Assignment info -->
        <div class="flex-1 min-w-0 flex flex-col gap-3">
          <!-- Row 1: Title & org badge -->
          <div class="flex items-start gap-2">
            <h3 class="font-semibold text-white group-hover:text-white/90 capitalize flex-1 min-w-0">
              {{ assignment.title }}
            </h3>
            <span class="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium bg-white/10 text-white/70 rounded uppercase tracking-wide">
              {{ assignment.orgName }}
            </span>
          </div>

          <!-- Row 2: Metadata -->
          <div class="flex items-center gap-2 text-xs text-white/50 flex-wrap">
            <span>{{ getAssignmentTarget(assignment) }}</span>
            <span class="text-white/30">•</span>
            <span>{{ formatRelativeDate(assignment.created_at) }}</span>
          </div>

          <!-- Row 3: Progress & badges -->
          <div class="flex items-center gap-3 flex-wrap">
            <!-- Status badge -->
            <div
              :class="[
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border',
                getStatusBadge(assignment).colorClass
              ]"
            >
              <span>{{ getStatusBadge(assignment).label }}</span>
            </div>

            <!-- Completion rate -->
            <div class="flex items-center gap-2">
              <div class="text-xs text-white/60">
                {{ getCompletionRate(assignment) }}
              </div>
              
              <!-- Progress bar -->
              <div v-if="assignment.totalAssigned > 0" class="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  class="h-full bg-green-400 transition-all"
                  :style="{ width: `${getCompletionPercentage(assignment)}%` }"
                ></div>
              </div>
            </div>

            <!-- Due date -->
            <div 
              v-if="formatDueDate(assignment.due_at)"
              :class="['text-xs', formatDueDate(assignment.due_at)!.colorClass]"
            >
              {{ formatDueDate(assignment.due_at)!.text }}
            </div>
          </div>
        </div>

        <!-- Arrow icon -->
        <div class="flex-shrink-0 flex items-center text-white/40 group-hover:text-white/70 transition-colors">
          <Icon icon="carbon:arrow-right" width="20" />
        </div>
      </button>
    </div>
  </section>
</template>

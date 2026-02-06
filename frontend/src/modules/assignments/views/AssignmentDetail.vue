<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { Icon } from '@iconify/vue';
import { assignmentsService } from '@/modules/assignments/services/assignmentsService';
import { formatRelativeTime } from '@/lib/date';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import type { AssignmentDetail } from '@/modules/assignments/types';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const assignmentId = computed(() => String(route.params.assignmentId ?? ''));
const orgSlug = computed(() => String(route.params.slug ?? ''));

// Permissions: owner, staff, manager, or site-wide admin
const canView = computed(() => {
  if (authStore.isAdmin) return true;
  const role = orgContext.value?.membership?.role;
  return role === 'owner' || role === 'manager' || role === 'staff';
});

const loading = ref(false);
const error = ref<string | null>(null);
const detail = ref<AssignmentDetail | null>(null);

const assignment = computed(() => detail.value?.assignment ?? null);
const summary = computed(() => detail.value?.summary ?? null);
const targets = computed(() => detail.value?.targets ?? []);
const clips = computed(() => detail.value?.clips ?? []);

// Group assignees: Completed vs Not Completed (no in-progress)
const completedAssignees = computed(() => {
  return detail.value?.assignees.filter(a => a.status === 'completed') ?? [];
});

const notCompletedAssignees = computed(() => {
  return detail.value?.assignees.filter(a => a.status !== 'completed') ?? [];
});

const completionPercent = computed(() => {
  if (!summary.value || summary.value.total_assignees === 0) return 0;
  return Math.round((summary.value.completed / summary.value.total_assignees) * 100);
});

// Format target labels
const targetLabels = computed(() => {
  if (!targets.value || targets.value.length === 0) return 'Unknown';
  return targets.value.map(t => t.target_label).join(', ');
});

async function load() {
  if (!assignmentId.value) {
    error.value = 'Invalid assignment ID';
    return;
  }

  if (!canView.value) {
    error.value = 'You do not have permission to view this assignment';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const data = await assignmentsService.getAssignmentDetail(assignmentId.value);
    detail.value = data;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load assignment details';
    console.error('Failed to load assignment detail:', e);
  } finally {
    loading.value = false;
  }
}

function goBack() {
  router.push({
    name: 'OrgAssignments',
    params: { slug: orgSlug.value }
  });
}

function viewInFeed() {
  router.push({
    name: 'OrgFeedView',
    params: { slug: orgSlug.value },
    query: { 
      source: 'assignments', 
      assignmentId: assignmentId.value 
    }
  });
}

function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return 'No due date';
  
  const date = new Date(dueAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return 'Overdue';
  } else if (diffDays === 0) {
    return 'Due today';
  } else if (diffDays === 1) {
    return 'Due tomorrow';
  } else if (diffDays <= 7) {
    return `Due in ${diffDays} days`;
  } else {
    return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="container py-8 text-white">
    <!-- Permission Error -->
    <div v-if="!canView" class="mt-8 text-center text-red-400">
      You do not have permission to view this page.
    </div>

    <!-- Loading State -->
    <div v-else-if="loading" class="mt-8">
      <div class="animate-pulse space-y-6">
        <div class="h-8 bg-white/10 rounded w-1/3"></div>
        <div class="h-4 bg-white/10 rounded w-1/4"></div>
        <div class="h-3 bg-white/10 rounded-full w-full"></div>
        <div class="grid grid-cols-3 gap-4">
          <div class="h-24 bg-white/10 rounded-lg"></div>
          <div class="h-24 bg-white/10 rounded-lg"></div>
          <div class="h-24 bg-white/10 rounded-lg"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="mt-8 text-center">
      <p class="text-red-400">{{ error }}</p>
      <button
        @click="goBack"
        class="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
      >
        Back to Assignments
      </button>
    </div>

    <!-- Content -->
    <div v-else-if="assignment" class="space-y-8">
      <!-- Back Button -->
      <button
        @click="goBack"
        class="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
      >
        <Icon icon="carbon:arrow-left" class="h-5 w-5" />
        <span>Back to Assignments</span>
      </button>

      <!-- Header -->
      <div class="space-y-3">
        <h1 class="text-3xl font-semibold">{{ assignment.title }}</h1>
        
        <div class="flex flex-wrap items-center gap-4 text-sm text-white/60">
          <span v-if="assignment.due_at">{{ formatDueDate(assignment.due_at) }}</span>
          <span>{{ clips.length }} {{ clips.length === 1 ? 'clip' : 'clips' }}</span>
          <button
            @click="viewInFeed"
            class="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Icon icon="carbon:play-filled" class="h-4 w-4" />
            View clips
          </button>
          <span>Assigned to: {{ targetLabels }}</span>
        </div>

        <p v-if="assignment.description" class="text-white/70">
          {{ assignment.description }}
        </p>
      </div>

      <!-- Progress Bar -->
      <div class="space-y-2">
        <div class="h-3 bg-white/10 rounded-full overflow-hidden">
          <div 
            class="h-full bg-green-500 transition-all duration-300"
            :style="{ width: completionPercent + '%' }"
          ></div>
        </div>
        <div class="text-sm text-white/60 text-right">
          {{ summary?.completed ?? 0 }} / {{ summary?.total_assignees ?? 0 }} completed ({{ completionPercent }}%)
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Completed -->
        <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
          <div class="text-4xl font-semibold text-white mb-1">{{ summary?.completed ?? 0 }}</div>
          <div class="text-sm text-white/60">Completed</div>
        </div>
        
        <!-- Not Completed -->
        <div class="bg-orange-500/10 border border-orange-500/20 rounded-lg p-6">
          <div class="text-4xl font-semibold text-white mb-1">
            {{ (summary?.in_progress ?? 0) + (summary?.not_started ?? 0) }}
          </div>
          <div class="text-sm text-white/60">Not Completed</div>
        </div>
      </div>

      <div class="border-t border-white/10 my-8"></div>

      <!-- Empty State -->
      <div v-if="!detail?.assignees || detail.assignees.length === 0" class="text-center py-12 text-white/50">
        No assignees yet. Assignment progress will appear after initialization.
      </div>

      <!-- Assignee Lists -->
      <div v-else class="space-y-8">
        <!-- Completed Section -->
        <section v-if="completedAssignees.length > 0" class="space-y-4">
          <h2 class="text-xl font-semibold flex items-center gap-2">
            <Icon icon="carbon:checkmark-filled" class="h-5 w-5 text-green-500" />
            Completed ({{ completedAssignees.length }})
          </h2>
          
          <div class="space-y-2">
            <div 
              v-for="assignee in completedAssignees" 
              :key="assignee.user_id"
              class="flex items-center justify-between p-3 bg-white/5 rounded-lg"
            >
              <span class="text-white">{{ assignee.user_name }}</span>
              <div class="flex items-center gap-4 text-sm">
                <span class="flex items-center gap-1 text-green-400">
                  <Icon icon="carbon:checkmark" class="h-4 w-4" />
                  Completed
                </span>
                <span class="text-white/60">{{ formatRelativeTime(assignee.last_activity) }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Not Completed Section -->
        <section v-if="notCompletedAssignees.length > 0" class="space-y-4">
          <h2 class="text-xl font-semibold flex items-center gap-2">
            <Icon icon="carbon:circle-outline" class="h-5 w-5 text-orange-500" />
            Not Completed ({{ notCompletedAssignees.length }})
          </h2>
          
          <div class="space-y-2">
            <div 
              v-for="assignee in notCompletedAssignees" 
              :key="assignee.user_id"
              class="flex items-center justify-between p-3 bg-white/5 rounded-lg"
            >
              <span class="text-white">{{ assignee.user_name }}</span>
              <span class="text-sm text-orange-400">Not started</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

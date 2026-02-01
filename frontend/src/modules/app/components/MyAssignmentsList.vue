<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useMyAssignments } from '@/modules/app/composables/useMyAssignments';
import type { AggregatedAssignment } from '@/modules/app/composables/useMyAssignments';
import LoadingDot from '@/components/LoadingDot.vue';
import ShimmerText from '@/components/ShimmerText.vue';

const router = useRouter();
const { topAssignments, selectedLimit, loading, error } = useMyAssignments();

// Format due date
const formatDueDate = (dueAt: string | null): string | null => {
  if (!dueAt) return null;
  
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
    return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
};

// Get assignment context text (who it's assigned to)
const getAssignmentContext = (assignment: AggregatedAssignment): string => {
  if (assignment.groupName) {
    return `Group: ${assignment.groupName}`;
  }
  if (assignment.assigned_to === 'team') {
    return 'Team-wide';
  }
  return 'Assigned to you';
};

// Navigate to feed with assignment
const openAssignment = (assignment: AggregatedAssignment) => {
  const query: Record<string, string> = {
    source: 'assignments',
    mode: assignment.assigned_to === 'player' ? 'assigned_to_you' : 
          assignment.assigned_to === 'team' ? 'assigned_to_team' : 
          'group',
    startAssignmentId: assignment.id,
  };
  
  // Add groupId for group assignments
  if (assignment.assigned_to === 'group' && assignment.groupName) {
    // We need the groupId, but we only have groupName
    // For now, we'll handle this in the feed view
    // This is a limitation we'll fix when we build the detail page
  }
  
  router.push({
    name: 'OrgFeedView',
    params: { slug: assignment.orgSlug },
    query,
  });
};
</script>

<template>
  <section class="container-lg text-white py-20">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
      <div class="text-2xl font-semibold">Your learnings</div>
      
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
    </div>
    
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center gap-2 text-sm text-white/60">
      <LoadingDot />
      <ShimmerText text="Loading your learnings" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-sm text-red-400">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="topAssignments.length === 0" class="text-xs text-white/40">
      No assignments yet. Your coach will assign clips for you to review.
    </div>

    <!-- Assignments list -->
    <div v-else class="space-y-3">
      <div 
        v-for="assignment in topAssignments" 
        :key="assignment.id"
        class="p-2 -mx-2"
      >
        <!-- Row 1: Title with status icon -->
        <div class="flex items-start gap-2 mb-1">
          <!-- Icon: checkmark for completed, radio button for incomplete -->
          <span class="mt-0.5">
            <Icon 
              v-if="assignment.completed" 
              icon="carbon:checkmark-filled" 
              class="text-green-400" 
              width="16" 
            />
            <Icon 
              v-else 
              icon="carbon:radio-button" 
              class="text-white/40" 
              width="16" 
            />
          </span>
          
          <!-- Assignment title (clickable) -->
          <span 
            @click="openAssignment(assignment)"
            class="capitalize cursor-pointer underline decoration-1 underline-offset-2"
            :class="[
              assignment.completed ? 'text-white/50 hover:text-white' : 'text-white hover:text-white'
            ]"
          >
            {{ assignment.title }}
          </span>
        </div>
        
        <!-- Row 2: Metadata (org, scope, due date) -->
        <div 
          class="text-xs flex items-center gap-2 ml-6"
          :class="assignment.completed ? 'text-white/40' : 'text-white/60'"
        >
          <!-- Org name -->
          <span>{{ assignment.orgName }}</span>
          
          <span class="text-white/30">•</span>
          
          <!-- Assignment scope (team-wide, group, direct) -->
          <span>{{ getAssignmentContext(assignment) }}</span>
          
          <!-- Due date or completion status -->
          <template v-if="formatDueDate(assignment.due_at) || assignment.completed">
            <span class="text-white/30">•</span>
            <span 
              v-if="assignment.completed && assignment.completed_at"
              class="text-green-400/70"
            >
              Completed
            </span>
            <span 
              v-else-if="formatDueDate(assignment.due_at)"
              :class="{
                'text-red-400': formatDueDate(assignment.due_at) === 'Overdue',
                'text-orange-400': formatDueDate(assignment.due_at) === 'Due today',
              }"
            >
              {{ formatDueDate(assignment.due_at) }}
            </span>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

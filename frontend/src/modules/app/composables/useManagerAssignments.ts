import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore';
import { assignmentsService } from '@/modules/assignments/services/assignmentsService';
import type { ManagerAssignment } from '@/modules/assignments/types';

export type AssignmentStatus = 'all' | 'active' | 'in_progress' | 'recently_done';

const RECENTLY_DONE_DAYS = 7;

export const useManagerAssignments = () => {
  const myOrgsStore = useMyOrganizationsStore();
  const { items: orgItems } = storeToRefs(myOrgsStore);

  const assignments = ref<ManagerAssignment[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedStatus = ref<AssignmentStatus>('all');
  const selectedLimit = ref<5 | 10 | 20>(5);

  const isEmpty = computed(() => !loading.value && assignments.value.length === 0);

  // Filter assignments by selected status
  const filteredAssignments = computed(() => {
    const now = new Date();
    const recentlyDoneCutoff = new Date(now.getTime() - RECENTLY_DONE_DAYS * 24 * 60 * 60 * 1000);

    switch (selectedStatus.value) {
      case 'active':
        // Not completed by anyone yet
        return assignments.value.filter((a: ManagerAssignment) => a.completionCount === 0);
      
      case 'in_progress':
        // At least one person completed, but not everyone
        return assignments.value.filter((a: ManagerAssignment) => 
          a.completionCount > 0 && a.completionCount < a.totalAssigned
        );
      
      case 'recently_done':
        // All assigned people completed within last 7 days
        return assignments.value.filter((a: ManagerAssignment) => {
          if (a.completionCount !== a.totalAssigned || a.totalAssigned === 0) return false;
          if (!a.lastCompletedAt) return false;
          const lastCompleted = new Date(a.lastCompletedAt);
          return lastCompleted >= recentlyDoneCutoff;
        });
      
      case 'all':
      default:
        return assignments.value;
    }
  });

  /**
   * Load assignments for all manager organizations
   */
  const loadAssignments = async () => {
    loading.value = true;
    error.value = null;

    try {
      // Get only manager orgs (staff, manager, owner)
      const managerOrgs = orgItems.value.filter(item => 
        ['staff', 'manager', 'owner'].includes(item.membership.role)
      );

      if (managerOrgs.length === 0) {
        assignments.value = [];
        return;
      }

      // Fetch assignments from all manager orgs in parallel
      const assignmentPromises = managerOrgs.map(async (item) => {
        try {
          const orgAssignments = await assignmentsService.getManagerAssignments(
            item.organization.id,
            selectedLimit.value
          );
          
          // Add org context to each assignment
          return orgAssignments.map(a => ({
            ...a,
            orgName: item.organization.name,
            orgSlug: item.organization.slug,
          }));
        } catch (err) {
          console.error(`Failed to load assignments for org ${item.organization.name}:`, err);
          return [];
        }
      });

      const allAssignments = await Promise.all(assignmentPromises);
      const flatAssignments = allAssignments.flat();
      
      // Sort by created date (newest first)
      flatAssignments.sort((a: ManagerAssignment, b: ManagerAssignment) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      // Apply limit to final aggregated list
      assignments.value = flatAssignments.slice(0, selectedLimit.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load assignments';
      assignments.value = [];
    } finally {
      loading.value = false;
    }
  };

  // Watch for limit changes and reload
  watch(selectedLimit, () => {
    void loadAssignments();
  });

  /**
   * Get completion rate display (e.g., "5/10 completed")
   */
  const getCompletionRate = (assignment: ManagerAssignment): string => {
    if (assignment.totalAssigned === 0) return 'No assignees';
    return `${assignment.completionCount}/${assignment.totalAssigned} completed`;
  };

  /**
   * Get completion percentage
   */
  const getCompletionPercentage = (assignment: ManagerAssignment): number => {
    if (assignment.totalAssigned === 0) return 0;
    return Math.round((assignment.completionCount / assignment.totalAssigned) * 100);
  };

  /**
   * Get status badge info
   */
  const getStatusBadge = (assignment: ManagerAssignment): { label: string; colorClass: string } => {
    const now = new Date();
    const recentlyDoneCutoff = new Date(now.getTime() - RECENTLY_DONE_DAYS * 24 * 60 * 60 * 1000);

    // Check if recently done
    if (assignment.completionCount === assignment.totalAssigned && assignment.totalAssigned > 0) {
      if (assignment.lastCompletedAt && new Date(assignment.lastCompletedAt) >= recentlyDoneCutoff) {
        return { label: 'Done', colorClass: 'bg-green-500/20 text-green-400 border-green-500/30' };
      }
      return { label: 'Completed', colorClass: 'bg-green-500/20 text-green-400 border-green-500/30' };
    }

    // Check if in progress
    if (assignment.completionCount > 0) {
      return { label: 'In Progress', colorClass: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
    }

    // Active (not started)
    return { label: 'Active', colorClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  };

  /**
   * Format due date with color coding
   */
  const formatDueDate = (dueAt: string | null): { text: string; colorClass: string } | null => {
    if (!dueAt) return null;

    const date = new Date(dueAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      return {
        text: overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`,
        colorClass: 'text-red-400'
      };
    } else if (diffDays === 0) {
      return { text: 'Due today', colorClass: 'text-orange-400' };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', colorClass: 'text-orange-400' };
    } else if (diffDays <= 3) {
      return { text: `Due in ${diffDays} days`, colorClass: 'text-orange-400' };
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays} days`, colorClass: 'text-white/60' };
    } else {
      return {
        text: `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        colorClass: 'text-white/60'
      };
    }
  };

  /**
   * Get assignment target display text
   */
  const getAssignmentTarget = (assignment: ManagerAssignment): string => {
    if (assignment.targets.length === 0) return 'No targets';
    if (assignment.targets.length === 1) {
      const target = assignment.targets[0];
      if (!target) return 'No targets';
      if (target.type === 'team') return 'Team-wide';
      if (target.type === 'group') return `Group: ${target.targetName}`;
      if (target.type === 'player') return `@${target.targetName}`;
    }
    // Multiple targets
    return `${assignment.targets.length} targets`;
  };

  /**
   * Format relative date
   */
  const formatRelativeDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
      }
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    }

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return {
    assignments: filteredAssignments,
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    isEmpty,
    selectedStatus,
    selectedLimit,
    loadAssignments,
    getCompletionRate,
    getCompletionPercentage,
    getStatusBadge,
    formatDueDate,
    getAssignmentTarget,
    formatRelativeDate,
  };
};

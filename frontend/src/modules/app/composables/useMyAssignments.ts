import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { assignmentsService } from '@/modules/assignments/services/assignmentsService';
import type { FeedAssignment } from '@/modules/assignments/types';

export type AggregatedAssignment = FeedAssignment & {
  orgId: string;
  orgName: string;
  orgSlug: string;
  groupName?: string;
};

export const useMyAssignments = () => {
  const myOrgs = useMyOrganizationsStore();
  const authStore = useAuthStore();
  
  const { items: orgItems, loaded: orgsLoaded } = storeToRefs(myOrgs);
  const { user } = storeToRefs(authStore);

  const assignments = ref<AggregatedAssignment[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Sort assignments by due date (soonest first, nulls last)
  const sortedAssignments = computed(() => {
    return [...assignments.value].sort((a, b) => {
      // Both have due dates: sort by soonest first
      if (a.due_at && b.due_at) {
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      }
      // Only a has due date: a comes first
      if (a.due_at) return -1;
      // Only b has due date: b comes first
      if (b.due_at) return 1;
      // Neither has due date: sort by created date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  });

  // Top 6 assignments
  const topAssignments = computed(() => sortedAssignments.value.slice(0, 6));
  
  // Total count
  const totalCount = computed(() => assignments.value.length);
  
  // Has more than 6
  const hasMore = computed(() => totalCount.value > 6);

  const load = async () => {
    if (!user.value?.id) {
      error.value = 'User not authenticated';
      return;
    }

    if (!orgsLoaded.value) {
      // Wait for orgs to load
      return;
    }

    if (orgItems.value.length === 0) {
      // No orgs, no assignments
      assignments.value = [];
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      // Fetch assignments for each org in parallel
      const allAssignmentsPromises = orgItems.value.map(async (item) => {
        try {
          const feed = await assignmentsService.getAssignmentsForUser(
            item.organization.id,
            user.value!.id
          );

          const orgContext = {
            orgId: item.organization.id,
            orgName: item.organization.name,
            orgSlug: item.organization.slug,
          };

          // Flatten all assignment types and add org context
          const aggregated: AggregatedAssignment[] = [
            // Direct assignments
            ...feed.assignedToYou.map(a => ({
              ...a,
              ...orgContext,
            })),
            // Team-wide assignments
            ...feed.assignedToTeam.map(a => ({
              ...a,
              ...orgContext,
            })),
            // Group assignments (with group name)
            ...feed.assignedToGroups.flatMap(g =>
              g.assignments.map(a => ({
                ...a,
                ...orgContext,
                groupName: g.groupName,
              }))
            ),
          ];

          return aggregated;
        } catch (err) {
          console.error(`Failed to load assignments for org ${item.organization.name}:`, err);
          return [];
        }
      });

      const allAssignments = await Promise.all(allAssignmentsPromises);
      assignments.value = allAssignments.flat();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load assignments';
      assignments.value = [];
    } finally {
      loading.value = false;
    }
  };

  // Watch for orgs to load and trigger assignment loading
  watch(orgsLoaded, (loaded) => {
    if (loaded) {
      void load();
    }
  }, { immediate: true });

  const refresh = () => load();

  return {
    assignments: sortedAssignments,
    topAssignments,
    totalCount,
    hasMore,
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    load,
    refresh,
  };
};

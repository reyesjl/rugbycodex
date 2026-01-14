<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { assignmentService, type FeedAssignment } from '@/modules/feed/services/assignmentService';
import AssignmentThumbnail from '@/modules/feed/components/AssignmentThumbnail.vue';

const router = useRouter();
const route = useRoute();

const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);

const loading = ref(false);
const error = ref<string | null>(null);

const assignedToYou = ref<FeedAssignment[]>([]);
const assignedToTeam = ref<FeedAssignment[]>([]);

async function loadAssignments() {
  if (!activeOrgId.value) return;

  loading.value = true;
  error.value = null;

  try {
    const [userAssignments, teamAssignments] = await Promise.all([
      assignmentService.listAssignmentsForUser(activeOrgId.value),
      assignmentService.listAssignmentsForTeam(activeOrgId.value),
    ]);

    assignedToYou.value = userAssignments;
    assignedToTeam.value = teamAssignments;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load assignments.';
  } finally {
    loading.value = false;
  }
}

watch(activeOrgId, () => {
  void loadAssignments();
}, { immediate: true });

function openFeed(mode: 'personal' | 'team') {
  const slug = route.params.slug;
  void router.push({
    name: 'OrgFeedView',
    params: { slug },
    query: { mode },
  });
}

function isCompleted(assignment: FeedAssignment): boolean {
  return Boolean(assignment.completed ?? assignment.watched ?? assignment.reviewed ?? false);
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}
</script>

<template>
  <div class="py-6">
    <div v-if="!activeOrgId" class="container-lg h-full w-full flex items-center justify-center text-white/60">
      Select an organization to view assignments.
    </div>

    <div v-else>
      <div class="container-lg">
        <div v-if="error" class="mb-6 text-red-200">
          {{ error }}
        </div>
      </div>

      <div class="space-y-10">
        <section>
          <div class="container-lg">
            <h2 class="text-3xl text-white">Assigned to you</h2>

            <div v-if="loading" class="mt-4 text-white/60">
              Loading assignments…
            </div>

            <div v-else-if="assignedToYou.length === 0" class="mt-4 text-white/60">
              Your coach has not assigned any clips to you yet.
            </div>
          </div>

          <div
            v-if="!loading && assignedToYou.length > 0"
            class="mt-4 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]"
          >
            <div class="flex gap-4 overflow-x-auto px-4 py-1 touch-pan-x">
              <AssignmentThumbnail
                v-for="assignment in assignedToYou"
                :key="assignment.id"
                :assignment="assignment"
                :completed="isCompleted(assignment)"
                :meta-line="formatDate(assignment.created_at)"
                :on-click="() => openFeed('personal')"
              />
            </div>
          </div>
        </section>

        <section class="border-t border-white/50 pt-5">
          <div class="container-lg">
            <h2 class="text-3xl text-white">Assigned to team</h2>

            <div v-if="loading" class="mt-4 text-white/60">
              Loading assignments…
            </div>

            <div v-else-if="assignedToTeam.length === 0" class="mt-4 text-white/60">
              No team-wide clips have been assigned yet.
            </div>
          </div>

          <div
            v-if="!loading && assignedToTeam.length > 0"
            class="mt-4 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]"
          >
            <div class="flex gap-4 overflow-x-auto px-4 py-1 touch-pan-x">
              <AssignmentThumbnail
                v-for="assignment in assignedToTeam"
                :key="assignment.id"
                :assignment="assignment"
                :completed="isCompleted(assignment)"
                :meta-line="formatDate(assignment.created_at)"
                :on-click="() => openFeed('team')"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

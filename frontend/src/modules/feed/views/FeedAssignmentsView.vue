<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { assignmentsService } from '@/modules/assignments/services/assignmentsService';
import type { FeedAssignment } from '@/modules/assignments/types';
import { toast } from '@/lib/toast';
import AssignmentThumbnail from '@/modules/feed/components/AssignmentThumbnail.vue';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);
const userId = computed(() => authStore.user?.id ?? null);
const orgSlug = computed(() => String(route.params.slug ?? ''));

const loading = ref(false);
const error = ref<string | null>(null);

const assignedToYou = ref<FeedAssignment[]>([]);
const assignedToTeam = ref<FeedAssignment[]>([]);
const assignedToGroups = ref<Array<{ groupId: string; groupName: string; assignments: FeedAssignment[] }>>([]);

async function loadAssignments() {
  if (!activeOrgId.value || !userId.value) return;

  loading.value = true;
  error.value = null;

  try {
    const feed = await assignmentsService.getAssignmentsForUser(activeOrgId.value, userId.value);
    assignedToYou.value = feed.assignedToYou;
    assignedToTeam.value = feed.assignedToTeam;
    assignedToGroups.value = feed.assignedToGroups;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load assignments.';
  } finally {
    loading.value = false;
  }
}

watch([activeOrgId, userId], () => {
  void loadAssignments();
}, { immediate: true });

function isCompleted(assignment: FeedAssignment): boolean {
  return Boolean(assignment.completed ?? false);
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function setCompletedLocally(assignmentId: string) {
  const update = (list: FeedAssignment[]) => list.map((a) => (a.id === assignmentId ? { ...a, completed: true } : a));
  assignedToYou.value = update(assignedToYou.value);
  assignedToTeam.value = update(assignedToTeam.value);
  assignedToGroups.value = assignedToGroups.value.map((g) => ({
    ...g,
    assignments: update(g.assignments),
  }));
}

async function openAssignment(assignment: FeedAssignment) {
  if (!userId.value) return;
  if (!assignment.segment_id) {
    toast({ variant: 'info', message: 'This assignment has no clips yet.', durationMs: 2500 });
    return;
  }

  setCompletedLocally(assignment.id);
  try {
    await assignmentsService.markAssignmentComplete(assignment.id, userId.value);
  } catch {
    // MVP: ignore failures; still navigate.
  }

  await router.push({
    name: 'MediaAssetSegment',
    params: { slug: orgSlug.value, segmentId: assignment.segment_id },
  });
}

function viewAll(sectionType: 'assigned-to-you' | 'assigned-to-team') {
  void router.push({ name: 'OrgFeedSection', params: { slug: orgSlug.value, sectionType } });
}

function viewAllGroup(groupId: string) {
  void router.push({ name: 'OrgFeedSection', params: { slug: orgSlug.value, sectionType: 'group' }, query: { groupId } });
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

      <div v-if="loading" class="container-lg text-white/60">Loading assignments…</div>

      <div
        v-else
        class="space-y-10"
      >
        <section v-if="assignedToYou.length > 0">
          <div class="container-lg flex items-end justify-between gap-4">
            <h2 class="text-3xl text-white">Assigned to you</h2>
            <button
              type="button"
              class="text-xs text-white/60 hover:text-white/80 transition"
              @click="viewAll('assigned-to-you')"
            >
              View all
            </button>
          </div>

          <div class="mt-4 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
            <div class="flex gap-4 overflow-x-auto px-4 py-1 touch-pan-x">
              <AssignmentThumbnail
                v-for="assignment in assignedToYou"
                :key="assignment.id"
                :assignment="assignment"
                :completed="isCompleted(assignment)"
                :meta-line="formatDate(assignment.created_at)"
                :on-click="() => openAssignment(assignment)"
              />
            </div>
          </div>
        </section>

        <section v-if="assignedToTeam.length > 0" class="border-t border-white/50 pt-5">
          <div class="container-lg flex items-end justify-between gap-4">
            <h2 class="text-3xl text-white">Assigned to team</h2>
            <button
              type="button"
              class="text-xs text-white/60 hover:text-white/80 transition"
              @click="viewAll('assigned-to-team')"
            >
              View all
            </button>
          </div>

          <div class="mt-4 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
            <div class="flex gap-4 overflow-x-auto px-4 py-1 touch-pan-x">
              <AssignmentThumbnail
                v-for="assignment in assignedToTeam"
                :key="assignment.id"
                :assignment="assignment"
                :completed="isCompleted(assignment)"
                :meta-line="formatDate(assignment.created_at)"
                :on-click="() => openAssignment(assignment)"
              />
            </div>
          </div>
        </section>

        <section
          v-for="g in assignedToGroups"
          :key="g.groupId"
          v-show="g.assignments.length > 0"
          class="border-t border-white/50 pt-5"
        >
          <div class="container-lg flex items-end justify-between gap-4">
            <h2 class="text-3xl text-white">{{ g.groupName }}</h2>
            <button
              type="button"
              class="text-xs text-white/60 hover:text-white/80 transition"
              @click="viewAllGroup(g.groupId)"
            >
              View all
            </button>
          </div>

          <div class="mt-4 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
            <div class="flex gap-4 overflow-x-auto px-4 py-1 touch-pan-x">
              <AssignmentThumbnail
                v-for="assignment in g.assignments"
                :key="assignment.id"
                :assignment="assignment"
                :completed="isCompleted(assignment)"
                :meta-line="formatDate(assignment.created_at)"
                :on-click="() => openAssignment(assignment)"
              />
            </div>
          </div>
        </section>

        <div
          v-if="assignedToYou.length === 0 && assignedToTeam.length === 0 && assignedToGroups.every((g) => g.assignments.length === 0)"
          class="container-lg text-white/60"
        >
          No assignments yet.
        </div>
      </div>
    </div>
  </div>
</template>

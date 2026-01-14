<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { assignmentService, type FeedAssignment } from '@/modules/feed/services/assignmentService';

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

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}
</script>

<template>
  <div
    class="w-full bg-black text-white
           h-[calc(100dvh-var(--main-nav-height))] overflow-y-auto
           md:h-auto md:min-h-[calc(100dvh-var(--main-nav-height))]"
  >
    <div v-if="!activeOrgId" class="h-full w-full flex items-center justify-center text-white/60">
      Select an organization to view assignments.
    </div>

    <div v-else class="mx-auto w-full max-w-3xl px-6 py-8">
      <div v-if="error" class="mb-6 text-red-200">
        {{ error }}
      </div>

      <div class="space-y-10">
        <section>
          <h2 class="text-sm font-semibold tracking-wide text-white/80 uppercase">Assigned to you</h2>

          <div v-if="loading" class="mt-4 text-white/60">
            Loading assignments…
          </div>

          <div v-else-if="assignedToYou.length === 0" class="mt-4 text-white/60">
            Your coach has not assigned any clips to you yet.
          </div>

          <ul v-else class="mt-4 divide-y divide-white/10">
            <li v-for="assignment in assignedToYou" :key="assignment.id">
              <button
                type="button"
                class="w-full py-4 text-left hover:bg-white/5 transition-colors"
                @click="openFeed('personal')"
              >
                <div class="text-base text-white">
                  {{ assignment.title || 'Untitled assignment' }}
                </div>
                <div class="mt-1 text-sm text-white/50">
                  {{ formatDate(assignment.created_at) }}
                </div>
              </button>
            </li>
          </ul>
        </section>

        <section>
          <h2 class="text-sm font-semibold tracking-wide text-white/80 uppercase">Assigned to team</h2>

          <div v-if="loading" class="mt-4 text-white/60">
            Loading assignments…
          </div>

          <div v-else-if="assignedToTeam.length === 0" class="mt-4 text-white/60">
            No team-wide clips have been assigned yet.
          </div>

          <ul v-else class="mt-4 divide-y divide-white/10">
            <li v-for="assignment in assignedToTeam" :key="assignment.id">
              <button
                type="button"
                class="w-full py-4 text-left hover:bg-white/5 transition-colors"
                @click="openFeed('team')"
              >
                <div class="text-base text-white">
                  {{ assignment.title || 'Untitled assignment' }}
                </div>
                <div class="mt-1 text-sm text-white/50">
                  {{ formatDate(assignment.created_at) }}
                </div>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

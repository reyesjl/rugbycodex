<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { assignmentsService } from '@/modules/assignments/services/assignmentsService';
import type { FeedAssignment } from '@/modules/assignments/types';
import { Icon } from '@iconify/vue';
import { toast } from '@/lib/toast';
import { CDN_BASE } from '@/lib/cdn';
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

function thumbnailUrl(assignment: FeedAssignment) {
  if (!assignment.thumbnail_path) return null;
  return `${CDN_BASE}/${assignment.thumbnail_path}`;
}

type AssignmentFeedMode = 'assigned_to_you' | 'assigned_to_team' | 'group';

function routeToFeed(options: {
  mode: AssignmentFeedMode;
  groupId?: string;
  startAssignmentId?: string;
}) {
  const query: Record<string, string> = {
    source: 'assignments',
    mode: options.mode,
  };
  if (options.groupId) query.groupId = options.groupId;
  if (options.startAssignmentId) query.startAssignmentId = options.startAssignmentId;

  return router.push({
    name: 'OrgFeedView',
    params: { slug: orgSlug.value },
    query,
  });
}

async function openAssignment(assignment: FeedAssignment, mode: AssignmentFeedMode, groupId?: string) {
  if (!userId.value) return;
  if (!assignment.segment_id) {
    toast({ variant: 'info', message: 'This assignment has no clips yet.', durationMs: 2500 });
    return;
  }

  await routeToFeed({ mode, groupId, startAssignmentId: assignment.id });
}

const scrollerClass = 'flex gap-5 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-2 touch-pan-x pr-6 pl-4 scroll-pl-4 sm:pl-[calc((100vw-640px)/2+1rem)] sm:scroll-pl-[calc((100vw-640px)/2+1rem)] md:pl-[calc((100vw-768px)/2+1rem)] md:scroll-pl-[calc((100vw-768px)/2+1rem)] lg:pl-[calc((100vw-1024px)/2+1rem)] lg:scroll-pl-[calc((100vw-1024px)/2+1rem)] xl:pl-[calc((100vw-1280px)/2+1rem)] xl:scroll-pl-[calc((100vw-1280px)/2+1rem)] 2xl:pl-[calc((100vw-1536px)/2+1rem)] 2xl:scroll-pl-[calc((100vw-1536px)/2+1rem)]';
const scrollerEndSpacerClass = 'shrink-0 w-[50vw] sm:w-[calc((100vw-640px)/2+1rem)] md:w-[calc((100vw-768px)/2+1rem)] lg:w-[calc((100vw-1024px)/2+1rem)] xl:w-[calc((100vw-1280px)/2+1rem)] 2xl:w-[calc((100vw-1536px)/2+1rem)]';
const scrollerRefs = ref<Record<string, HTMLElement | null>>({});

function setScrollerRef(key: string, el: Element | ComponentPublicInstance | null) {
  scrollerRefs.value[key] = el instanceof HTMLElement ? el : null;
}

function scrollSection(key: string, direction: number) {
  const el = scrollerRefs.value[key];
  if (!el) return;
  const amount = Math.max(220, el.clientWidth * 0.85);
  el.scrollBy({ left: amount * direction, behavior: 'smooth' });
}
</script>

<template>
  <div class="py-8 overflow-x-hidden">
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
        class="space-y-12"
      >
        <section v-if="assignedToYou.length > 0">
          <div class="container-lg flex items-end justify-between gap-4">
            <h2 class="text-2xl md:text-3xl text-white">Assigned to you</h2>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white/90 hover:cursor-pointer"
                aria-label="Scroll assigned to you left"
                @click="scrollSection('assigned_to_you', -1)"
              >
                <Icon icon="carbon:chevron-left" class="h-5 w-5" />
              </button>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white/90 hover:cursor-pointer"
                aria-label="Scroll assigned to you right"
                @click="scrollSection('assigned_to_you', 1)"
              >
                <Icon icon="carbon:chevron-right" class="h-5 w-5" />
              </button>
            </div>
          </div>

          <div class="mt-5 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
            <div :ref="(el) => setScrollerRef('assigned_to_you', el)" :class="scrollerClass">
              <AssignmentThumbnail
                v-for="assignment in assignedToYou"
                :key="assignment.id"
                :assignment="assignment"
                :completed="isCompleted(assignment)"
                :thumbnail-url="thumbnailUrl(assignment)"
                :on-click="() => openAssignment(assignment, 'assigned_to_you')"
              />
              <div aria-hidden="true" :class="scrollerEndSpacerClass"></div>
            </div>
          </div>
        </section>

        <section v-if="assignedToTeam.length > 0">
          <div class="container-lg flex items-end justify-between gap-4">
            <h2 class="text-2xl md:text-3xl text-white">Assigned to team</h2>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white/90 hover:cursor-pointer"
                aria-label="Scroll assigned to team left"
                @click="scrollSection('assigned_to_team', -1)"
              >
                <Icon icon="carbon:chevron-left" class="h-5 w-5" />
              </button>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white/90 hover:cursor-pointer"
                aria-label="Scroll assigned to team right"
                @click="scrollSection('assigned_to_team', 1)"
              >
                <Icon icon="carbon:chevron-right" class="h-5 w-5" />
              </button>
            </div>
          </div>

          <div class="mt-5 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
            <div :ref="(el) => setScrollerRef('assigned_to_team', el)" :class="scrollerClass">
              <AssignmentThumbnail
                v-for="assignment in assignedToTeam"
                :key="assignment.id"
                :assignment="assignment"
                :completed="isCompleted(assignment)"
                :thumbnail-url="thumbnailUrl(assignment)"
                :on-click="() => openAssignment(assignment, 'assigned_to_team')"
              />
              <div aria-hidden="true" :class="scrollerEndSpacerClass"></div>
            </div>
          </div>
        </section>

        <section
          v-for="g in assignedToGroups"
          :key="g.groupId"
          v-show="g.assignments.length > 0"
        >
          <div class="container-lg flex items-end justify-between gap-4">
            <h2 class="text-2xl md:text-3xl text-white">{{ g.groupName }}</h2>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white/90 hover:cursor-pointer"
                :aria-label="`Scroll ${g.groupName} left`"
                @click="scrollSection(g.groupId, -1)"
              >
                <Icon icon="carbon:chevron-left" class="h-5 w-5" />
              </button>
              <button
                type="button"
                class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white/90 hover:cursor-pointer"
                :aria-label="`Scroll ${g.groupName} right`"
                @click="scrollSection(g.groupId, 1)"
              >
                <Icon icon="carbon:chevron-right" class="h-5 w-5" />
              </button>
            </div>
          </div>

          <div class="mt-5 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
            <div :ref="(el) => setScrollerRef(g.groupId, el)" :class="scrollerClass">
              <AssignmentThumbnail
                v-for="assignment in g.assignments"
                :key="assignment.id"
                :assignment="assignment"
                :completed="isCompleted(assignment)"
                :thumbnail-url="thumbnailUrl(assignment)"
                :on-click="() => openAssignment(assignment, 'group', g.groupId)"
              />
              <div aria-hidden="true" :class="scrollerEndSpacerClass"></div>
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

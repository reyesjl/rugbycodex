<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';

import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { assignmentsService } from '@/modules/assignments/services/assignmentsService';
import type { FeedAssignment } from '@/modules/assignments/types';
import { toast } from '@/lib/toast';

import AssignmentThumbnail from '@/modules/feed/components/AssignmentThumbnail.vue';

const props = defineProps<{
  sectionType: string;
}>();

const route = useRoute();
const router = useRouter();

const authStore = useAuthStore();
const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const orgId = computed(() => orgContext.value?.organization?.id ?? null);
const orgSlug = computed(() => String(route.params.slug ?? ''));
const userId = computed(() => authStore.user?.id ?? null);

const groupId = computed(() => String(route.query.groupId ?? ''));

const loading = ref(false);
const error = ref<string | null>(null);

const assignments = ref<FeedAssignment[]>([]);
const title = computed(() => {
  if (props.sectionType === 'assigned-to-you') return 'Assigned to you';
  if (props.sectionType === 'assigned-to-team') return 'Assigned to team';
  if (props.sectionType === 'group') return 'Assigned to group';
  return 'Assignments';
});

async function openAssignment(a: FeedAssignment) {
  if (!userId.value) return;
  if (!a.segment_id) {
    toast({ variant: 'info', message: 'This assignment has no clips yet.', durationMs: 2500 });
    return;
  }

  await router.push({
    name: 'MediaAssetSegment',
    params: { slug: orgSlug.value, segmentId: a.segment_id },
  });
}

async function load() {
  if (!orgId.value || !userId.value) return;

  loading.value = true;
  error.value = null;

  try {
    const feed = await assignmentsService.getAssignmentsForUser(orgId.value, userId.value);

    if (props.sectionType === 'assigned-to-you') {
      assignments.value = feed.assignedToYou;
      return;
    }

    if (props.sectionType === 'assigned-to-team') {
      assignments.value = feed.assignedToTeam;
      return;
    }

    if (props.sectionType === 'group') {
      const g = feed.assignedToGroups.find((x) => x.groupId === groupId.value);
      assignments.value = g?.assignments ?? [];
      return;
    }

    assignments.value = [];
    error.value = 'Unknown section.';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load assignments.';
  } finally {
    loading.value = false;
  }
}

watch([orgId, userId, () => props.sectionType, groupId], () => {
  void load();
}, { immediate: true });
</script>

<template>
  <div class="py-6">
    <div class="container-lg">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl text-white">{{ title }}</h1>
        <button
          type="button"
          class="text-xs text-white/60 hover:text-white/80 transition"
          @click="router.back()"
        >
          Back
        </button>
      </div>

      <div v-if="error" class="mt-4 text-red-200">{{ error }}</div>
      <div v-else-if="loading" class="mt-4 text-white/60">Loading…</div>
      <div v-else-if="assignments.length === 0" class="mt-4 text-white/60">No assignments.</div>

      <div v-else class="mt-6 flex flex-wrap gap-4">
        <AssignmentThumbnail
          v-for="a in assignments"
          :key="a.id"
          :assignment="a"
          :completed="Boolean(a.completed)"
          :on-click="() => openAssignment(a)"
        />
      </div>
    </div>
  </div>
</template>

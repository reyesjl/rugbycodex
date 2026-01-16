<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import FeedContainer from '@/modules/feed/components/FeedContainer.vue';
import { useFeedData } from '@/modules/feed/composables/useFeedData';
import type { AssignmentFeedMode } from '@/modules/assignments/services/assignmentsService';
import { useActiveOrganizationStore } from '@/modules/orgs/stores/useActiveOrganizationStore';
import { hasOrgAccess } from '@/modules/orgs/composables/useOrgCapabilities';
import { toast } from '@/lib/toast';

/**
 * Route-level view.
 *
 * Responsibility:
 * - Fetch feed items and pass them to FeedContainer.
 *
 * Non-goals:
 * - Navigation logic
 * - Media/narration business logic
 */

const route = useRoute();
const authStore = useAuthStore();
const activeOrgStore = useActiveOrganizationStore();
const { orgContext } = storeToRefs(activeOrgStore);

const activeOrgId = computed(() => orgContext.value?.organization?.id ?? null);
const activeOrgName = computed(() => orgContext.value?.organization?.name ?? null);
const userId = computed(() => authStore.user?.id ?? null);
const membershipRole = computed(() => (orgContext.value?.membership?.role ?? null) as any);
const canAddIdentityTag = computed(() => hasOrgAccess(membershipRole.value, 'member'));

const segmentId = computed(() => String(route.query.segmentId ?? ''));
const source = computed(() => {
  const querySource = String(route.query.source ?? '');
  if (querySource) return querySource;
  if (segmentId.value) return 'segment';
  return '';
});
const assignmentId = computed(() => String(route.query.assignmentId ?? ''));
const assignmentMode = computed<AssignmentFeedMode | null>(() => {
  const mode = String(route.query.mode ?? '');
  if (mode === 'assigned_to_you' || mode === 'assigned_to_team' || mode === 'group') {
    return mode;
  }
  return null;
});
const groupId = computed(() => String(route.query.groupId ?? ''));
const startAssignmentId = computed(() => String(route.query.startAssignmentId ?? ''));

const feedData = useFeedData({
  orgId: () => activeOrgId.value,
  orgName: () => activeOrgName.value,
  userId: () => userId.value,
  source: () => source.value,
  segmentId: () => segmentId.value,
  assignmentId: () => assignmentId.value,
  assignmentMode: () => assignmentMode.value,
  groupId: () => groupId.value,
  startAssignmentId: () => startAssignmentId.value,
});

const {
  items,
  loading,
  error,
  profileNameById,
  handleWatchedHalf,
  segmentTags,
} = feedData;

function feedItemHasIdentityTag(segmentId: string): boolean {
  const user = userId.value;
  if (!user) return false;
  const item = items.value.find((entry) => String(entry.mediaAssetSegmentId) === segmentId);
  const tags = item?.segment?.tags ?? [];
  return tags.some((tag) => tag.tag_type === 'identity' && String(tag.created_by) === String(user));
}

async function handleAddIdentityTag(payload: { segmentId: string }) {
  const segmentId = String(payload.segmentId ?? '');
  if (!segmentId) return;
  if (!userId.value) return;
  if (!canAddIdentityTag.value) return;
  if (feedItemHasIdentityTag(segmentId)) return;

  try {
    const tag = await segmentTags.addTag({
      segmentId,
      tagKey: 'self',
      tagType: 'identity',
    });
    if (!tag) return;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to add identity tag.';
    toast({ message, variant: 'error', durationMs: 2600 });
  }
}
</script>

<template>
  <!--
    Feed should consume the remaining viewport height below the fixed MainNav.
    AppLayout offsets content with padding-top: var(--main-nav-height), so we
    subtract the same value here to avoid creating a second (page-level) scroll.
  -->
  <div
    class="w-full bg-black
           h-[calc(100dvh-var(--main-nav-height))] overflow-hidden
           md:h-auto md:overflow-visible md:min-h-[calc(100dvh-var(--main-nav-height))]"
  >
    <div v-if="!activeOrgId" class="h-full w-full flex items-center justify-center text-white/60">
      Select an organization to view the feed.
    </div>

    <div v-else-if="loading" class="h-full w-full flex items-center justify-center text-white/60">
      Loading feed…
    </div>

    <div v-else-if="error" class="h-full w-full flex items-center justify-center px-6 text-red-200">
      {{ error }}
    </div>

    <div v-else-if="items.length === 0" class="h-full w-full flex items-center justify-center text-white/60">
      No clips yet.
    </div>

    <FeedContainer
      v-else
      :items="items"
      :profile-name-by-id="profileNameById"
      @watchedHalf="handleWatchedHalf"
      @addIdentityTag="handleAddIdentityTag"
    />
  </div>
</template>

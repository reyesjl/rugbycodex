import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { myMomentsService } from '@/modules/app/services/myMomentsService';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore';
import type { MomentGroup } from '@/modules/app/services/myMomentsService';

export function useMyMoments() {
  const router = useRouter();
  const myOrgsStore = useMyOrganizationsStore();

  const momentGroups = ref<MomentGroup[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  const isEmpty = computed(() => loaded.value && momentGroups.value.length === 0);
  const hasData = computed(() => momentGroups.value.length > 0);

  /**
   * Load all user moments and group them by match
   */
  async function loadMoments(): Promise<void> {
    if (loading.value) return;

    loading.value = true;
    error.value = null;

    try {
      const moments = await myMomentsService.fetchUserMoments();
      const groups = myMomentsService.groupMomentsByMatch(moments);
      momentGroups.value = groups;
      loaded.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load moments';
      momentGroups.value = [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * Build a deep link to the moments feed view for a specific segment
   * 
   * Format: /app/{org_slug}/feed/moments/{media_asset_id}?segment={segment_id}
   */
  function buildDeepLink(orgId: string, mediaAssetId: string, segmentId: string): string {
    // Find the org slug from the user's organizations
    const org = myOrgsStore.items.find((item) => item.organization.id === orgId);
    const orgSlug = org?.organization.slug;

    if (!orgSlug) {
      // Fallback: if org not found in store, use org ID (shouldn't happen normally)
      console.warn(`Organization slug not found for org ID: ${orgId}`);
      return `/app/feed/moments/${mediaAssetId}?segment=${segmentId}`;
    }

    return `/organizations/${orgSlug}/feed/moments/${mediaAssetId}?segment=${segmentId}`;
  }

  /**
   * Navigate to a specific moment in the feed player
   */
  function navigateToMoment(orgId: string, mediaAssetId: string, segmentId: string): void {
    const path = buildDeepLink(orgId, mediaAssetId, segmentId);
    router.push(path);
  }

  /**
   * Format seconds as MM:SS or HH:MM:SS
   */
  function formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Format match date as relative or absolute
   */
  function formatMatchDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    // Format as "Jan 15, 2026"
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return {
    momentGroups,
    loading,
    error,
    loaded,
    isEmpty,
    hasData,
    loadMoments,
    buildDeepLink,
    navigateToMoment,
    formatTimestamp,
    formatMatchDate,
  };
}

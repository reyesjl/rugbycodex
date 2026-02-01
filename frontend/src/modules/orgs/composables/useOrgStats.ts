import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useActiveOrganizationStore } from '../stores/useActiveOrganizationStore';
import { useAuthStore } from '@/modules/auth/stores/useAuthStore';
import { mediaService } from '@/modules/media/services/mediaService';
import { segmentService } from '@/modules/media/services/segmentService';
import { narrationService } from '@/modules/narrations/services/narrationService';
import { assignmentsService } from '@/modules/assignments/services/assignmentsService';
import { supabase } from '@/lib/supabaseClient';
import type { Narration } from '@/modules/narrations/types/Narration';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';

export const useOrgStats = () => {
  const activeOrgStore = useActiveOrganizationStore();
  const authStore = useAuthStore();
  const { orgContext } = storeToRefs(activeOrgStore);
  const { user } = storeToRefs(authStore);

  const loading = ref(false);
  const error = ref<string | null>(null);

  // Raw data
  const allMatches = ref<OrgMediaAsset[]>([]);
  const allNarrations = ref<Narration[]>([]);
  const totalSegments = ref(0);
  const activeAssignmentsCount = ref(0);
  const identityTaggedSegmentsCount = ref(0);

  // Stat 1: Matches (last 30 days)
  const matchesLast30Days = computed(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return allMatches.value.filter(match => match.created_at >= cutoff).length;
  });

  // Stat 2: Coverage (reviewed vs not)
  // Uses same tier system as managerMatchCoverageService:
  // - not_covered: < 25 narrations
  // - partial: 25-34 narrations
  // - well_covered: 35-44 narrations
  // - very_well_covered: 45+ narrations
  const coverage = computed(() => {
    if (allMatches.value.length === 0) {
      return {
        reviewed: 0,
        total: 0,
        percentage: 0,
        display: '0 / 0 (0%)'
      };
    }

    // Count narrations per match
    const matchesWithNarrations = new Map<string, number>();
    
    for (const narration of allNarrations.value) {
      const count = matchesWithNarrations.get(narration.media_asset_id) ?? 0;
      matchesWithNarrations.set(narration.media_asset_id, count + 1);
    }

    // A match is "well covered" if it has at least 35 narrations (well_covered or very_well_covered tier)
    const wellCovered = allMatches.value.filter(match => {
      const narrationCount = matchesWithNarrations.get(match.id) ?? 0;
      return narrationCount >= 35;
    }).length;

    const total = allMatches.value.length;
    const percentage = total > 0 ? Math.round((wellCovered / total) * 100) : 0;

    return {
      reviewed: wellCovered,
      total,
      percentage,
      display: `${wellCovered} / ${total} (${percentage}%)`
    };
  });

  // Stat 3: Learning activity (flow) - active assignments
  const learningActivity = computed(() => {
    return {
      count: activeAssignmentsCount.value,
      display: activeAssignmentsCount.value === 1 
        ? '1 active assignment' 
        : `${activeAssignmentsCount.value} active assignments`
    };
  });

  // Stat 4: Attention density - average narrations per match
  // Aligns with coverage tiers:
  // - <25 avg: not_covered tier
  // - 25-34 avg: partial tier
  // - 35-44 avg: well_covered tier
  // - 45+ avg: very_well_covered tier
  const attentionDensity = computed(() => {
    if (allMatches.value.length === 0) {
      return {
        average: 0,
        display: '0 avg narrations',
        tier: 'none' as const
      };
    }

    const avg = Math.round(allNarrations.value.length / allMatches.value.length);
    
    // Determine coverage tier based on average
    let tier: 'not_covered' | 'partial' | 'well_covered' | 'very_well_covered' | 'none';
    if (avg < 25) tier = 'not_covered';
    else if (avg < 35) tier = 'partial';
    else if (avg < 45) tier = 'well_covered';
    else tier = 'very_well_covered';

    return {
      average: avg,
      display: `${avg} avg narrations`,
      tier
    };
  });

  // Stat 5: Identity coverage - segments with identity tags by players
  const identityCoverage = computed(() => {
    return {
      count: identityTaggedSegmentsCount.value,
      display: identityTaggedSegmentsCount.value === 1
        ? '1 clip tagged'
        : `${identityTaggedSegmentsCount.value} clips tagged`
    };
  });

  const loadStats = async () => {
    const orgId = orgContext.value?.organization?.id;
    const currentUserId = user.value?.id;
    
    if (!orgId) return;

    loading.value = true;
    error.value = null;

    try {
      // Load all matches for the org
      const matches = await mediaService.listByOrganization(orgId, { limit: 100 });
      allMatches.value = matches;

      // Load all narrations for these matches
      const narrationLists = await Promise.all(
        matches.map(asset => narrationService.listNarrationsForMediaAsset(asset.id))
      );
      allNarrations.value = narrationLists.flat();

      // Count total segments and get segment IDs for identity tag query
      let allSegmentIds: string[] = [];
      if (matches.length > 0) {
        const segmentCounts = await Promise.all(
          matches.map(asset => segmentService.listSegmentsForMediaAsset(asset.id))
        );
        totalSegments.value = segmentCounts.reduce((sum, segments) => sum + segments.length, 0);
        allSegmentIds = segmentCounts.flat().map(seg => seg.id).filter(Boolean);
      } else {
        totalSegments.value = 0;
      }

      // Load active assignments count
      if (currentUserId) {
        const userAssignments = await assignmentsService.getAssignmentsForUser(orgId, currentUserId);
        const assignedToYou = userAssignments.assignedToYou ?? [];
        activeAssignmentsCount.value = assignedToYou.filter(a => !a.completed).length;
      } else {
        activeAssignmentsCount.value = 0;
      }

      // Count identity-tagged segments (only if we have segments)
      if (allSegmentIds.length > 0) {
        const { data: identityTags, error: tagsError } = await supabase
          .from('segment_tags')
          .select('segment_id')
          .eq('tag_type', 'identity')
          .in('segment_id', allSegmentIds);

        if (tagsError) throw tagsError;

        // Get unique segment IDs with identity tags
        const uniqueSegmentIds = new Set(identityTags?.map((tag: { segment_id: string }) => tag.segment_id) ?? []);
        identityTaggedSegmentsCount.value = uniqueSegmentIds.size;
      } else {
        identityTaggedSegmentsCount.value = 0;
      }

    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load stats';
      console.error('Error loading org stats:', err);
    } finally {
      loading.value = false;
    }
  };

  // Watch for org changes and reload stats
  watch(
    () => orgContext.value?.organization?.id,
    (newOrgId) => {
      if (newOrgId) {
        void loadStats();
      }
    },
    { immediate: true }
  );

  return {
    loading,
    error,
    matchesLast30Days,
    coverage,
    learningActivity,
    attentionDensity,
    identityCoverage,
    loadStats,
  };
};

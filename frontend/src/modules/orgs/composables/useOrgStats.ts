import { ref, computed, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useActiveOrganizationStore } from '../stores/useActiveOrganizationStore';
import { orgService } from '../services/orgServiceV2';
import type { OrgStatsRpc } from '../types';

export const useOrgStats = () => {
  const activeOrgStore = useActiveOrganizationStore();
  const { orgContext } = storeToRefs(activeOrgStore);

  const loading = ref(false);
  const error = ref<string | null>(null);

  // Raw data from RPC
  const rpcStats = ref<OrgStatsRpc | null>(null);

  // Stat 1: Matches (last 30 days)
  const matchesLast30Days = computed(() => {
    return rpcStats.value?.matches_last_30_days ?? 0;
  });

  // Stat 2: Coverage (reviewed vs not)
  // Uses same tier system as managerMatchCoverageService:
  // - not_covered: < 25 narrations
  // - partial: 25-34 narrations
  // - well_covered: 35-44 narrations (this is what we count as "reviewed")
  // - very_well_covered: 45+ narrations
  const coverage = computed(() => {
    const total = rpcStats.value?.total_matches ?? 0;
    const reviewed = rpcStats.value?.well_covered_matches ?? 0;

    if (total === 0) {
      return {
        reviewed: 0,
        total: 0,
        percentage: 0,
        display: '0 / 0 (0%)'
      };
    }

    const percentage = Math.round((reviewed / total) * 100);

    return {
      reviewed,
      total,
      percentage,
      display: `${reviewed} / ${total} (${percentage}%)`
    };
  });

  // Stat 3: Learning activity - org-wide incomplete assignments
  const learningActivity = computed(() => {
    const count = rpcStats.value?.incomplete_assignments ?? 0;
    return {
      count,
      display: count === 1 
        ? '1 incomplete assignment' 
        : `${count} incomplete assignments`
    };
  });

  // Stat 4: Attention density - average narrations per match
  // Aligns with coverage tiers:
  // - <25 avg: not_covered tier
  // - 25-34 avg: partial tier
  // - 35-44 avg: well_covered tier
  // - 45+ avg: very_well_covered tier
  const attentionDensity = computed(() => {
    const avg = rpcStats.value?.avg_narrations_per_match ?? 0;

    if (avg === 0) {
      return {
        average: 0,
        display: '0 avg narrations',
        tier: 'none' as const
      };
    }
    
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
    const count = rpcStats.value?.identity_tagged_segments ?? 0;
    return {
      count,
      display: count === 1
        ? '1 clip tagged'
        : `${count} clips tagged`
    };
  });

  const loadStats = async () => {
    const orgId = orgContext.value?.organization?.id;
    
    if (!orgId) return;

    loading.value = true;
    error.value = null;

    try {
      // Single RPC call for all stats including incomplete assignments (replaces 104+ queries!)
      const stats = await orgService.getOrgStatsRpc(orgId);
      rpcStats.value = stats;

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

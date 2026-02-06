import { ref, computed } from 'vue';
import { supabase } from '@/lib/supabaseClient';
import type { MediaAssetKind } from '@/modules/media/types/MediaAssetKind';

export type CoverageTier = 'not_covered' | 'partial' | 'well_covered' | 'very_well_covered';

export type MediaAssetWithCoverage = {
  id: string;
  orgId: string;
  fileName: string;
  kind: MediaAssetKind;
  durationSeconds: number;
  createdAt: Date;
  thumbnailPath: string | null;
  narrationCount: number;
  coverageTier: CoverageTier;
  maxGapMinutes: number | null;
  hasLargeGap: boolean;
};

type CoverageDisplay = {
  label: string;
  colorClass: string;
  icon: string;
};

const GAP_THRESHOLD_MINUTES = 8;

const COVERAGE_DISPLAY: Record<CoverageTier, CoverageDisplay> = {
  not_covered: {
    label: 'Unreviewed',
    colorClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: 'carbon:warning-alt',
  },
  partial: {
    label: 'Partially Covered',
    colorClass: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: 'carbon:in-progress',
  },
  well_covered: {
    label: 'Well Covered',
    colorClass: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: 'carbon:checkmark',
  },
  very_well_covered: {
    label: 'Very Well Covered',
    colorClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: 'carbon:checkmark-filled',
  },
};

/**
 * Get coverage tier based on narration count
 */
function getBaseCoverageTier(narrationCount: number): CoverageTier {
  if (narrationCount < 25) return 'not_covered';
  if (narrationCount < 35) return 'partial';
  if (narrationCount < 45) return 'well_covered';
  return 'very_well_covered';
}

/**
 * Demote coverage tier by one level
 */
function demoteTier(tier: CoverageTier): CoverageTier {
  const tierOrder: CoverageTier[] = ['not_covered', 'partial', 'well_covered', 'very_well_covered'];
  const currentIndex = tierOrder.indexOf(tier);
  if (currentIndex > 0) {
    return tierOrder[currentIndex - 1]!;
  }
  return tier; // Can't demote 'not_covered'
}

export const useOrgMediaWithCoverage = (orgId: string | null) => {
  const assets = ref<MediaAssetWithCoverage[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedKind = ref<'all' | MediaAssetKind>('all');
  const selectedLimit = ref<20 | 50 | 100>(20);

  const isEmpty = computed(() => !loading.value && assets.value.length === 0);
  
  // Check if filtered results are empty (when filters applied)
  const isFilteredEmpty = computed(() => 
    !loading.value && assets.value.length > 0 && filteredAssets.value.length === 0
  );

  // Filter assets by selected kind
  const filteredAssets = computed(() => {
    if (selectedKind.value === 'all') {
      return assets.value;
    }
    return assets.value.filter(asset => asset.kind === selectedKind.value);
  });

  /**
   * Load media assets with coverage data for a single organization
   */
  const loadAssets = async () => {
    if (!orgId) {
      assets.value = [];
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const { data, error: rpcError } = await supabase.rpc('rpc_get_manager_matches_with_coverage', {
        p_org_id: orgId,
        p_limit: selectedLimit.value,
      });

      if (rpcError) throw rpcError;

      if (!data || data.length === 0) {
        assets.value = [];
        return;
      }

      // Transform RPC results to MediaAssetWithCoverage
      assets.value = data.map((row: any) => {
        const narrationCount = row.narration_count ?? 0;
        const maxGapMinutes = row.max_gap_minutes ?? null;
        const hasLargeGap = maxGapMinutes !== null && maxGapMinutes > GAP_THRESHOLD_MINUTES;

        // Calculate coverage tier
        let coverageTier = getBaseCoverageTier(narrationCount);
        if (hasLargeGap) {
          coverageTier = demoteTier(coverageTier);
        }

        return {
          id: row.media_asset_id,
          orgId: row.org_id,
          fileName: row.file_name,
          kind: row.kind,
          durationSeconds: Number(row.duration_seconds ?? 0),
          createdAt: new Date(row.created_at),
          thumbnailPath: row.thumbnail_path,
          narrationCount,
          coverageTier,
          maxGapMinutes,
          hasLargeGap,
        };
      });
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load media assets';
      assets.value = [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * Get display properties for a coverage tier
   */
  const getCoverageDisplay = (tier: CoverageTier): CoverageDisplay => {
    return COVERAGE_DISPLAY[tier];
  };

  /**
   * Format duration in minutes/hours
   */
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  /**
   * Format relative date (e.g., "2 days ago")
   */
  const formatRelativeDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
      }
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    }

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  /**
   * Get narration count display with progress to next tier
   */
  const getNarrationProgress = (count: number): { main: string; helper: string | null } => {
    const plural = count === 1 ? 'narration' : 'narrations';
    const main = `${count} ${plural}`;
    
    if (count < 25) {
      const needed = 25 - count;
      return { main, helper: `${needed} more for Partially Covered` };
    } else if (count < 35) {
      const needed = 35 - count;
      return { main, helper: `${needed} more for Well Covered` };
    } else if (count < 45) {
      const needed = 45 - count;
      return { main, helper: `${needed} more for Very Well Covered` };
    } else {
      return { main, helper: null };
    }
  };

  return {
    assets,
    filteredAssets,
    loading,
    error,
    isEmpty,
    isFilteredEmpty,
    selectedKind,
    selectedLimit,
    loadAssets,
    getCoverageDisplay,
    formatDuration,
    formatRelativeDate,
    getNarrationProgress,
  };
};

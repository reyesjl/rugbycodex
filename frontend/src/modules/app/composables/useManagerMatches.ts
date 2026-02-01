import { ref, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useMyOrganizationsStore } from '@/modules/orgs/stores/useMyOrganizationsStore';
import { managerMatchCoverageService } from '../services/managerMatchCoverageService';
import type { MatchWithCoverage, CoverageTier } from '../types/MatchWithCoverage';
import type { MediaAssetKind } from '@/modules/media/types/MediaAssetKind';

type CoverageDisplay = {
  label: string;
  colorClass: string;
  icon: string;
};

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

export const useManagerMatches = () => {
  const myOrgsStore = useMyOrganizationsStore();
  const { items: organizations } = storeToRefs(myOrgsStore);

  const matches = ref<MatchWithCoverage[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedKind = ref<'all' | MediaAssetKind>('all');
  const selectedLimit = ref<5 | 10 | 20>(5);

  const isEmpty = computed(() => !loading.value && matches.value.length === 0);

  // Filter matches by selected kind
  const filteredMatches = computed(() => {
    if (selectedKind.value === 'all') {
      return matches.value;
    }
    return matches.value.filter(match => match.kind === selectedKind.value);
  });

  /**
   * Load matches for all manager organizations
   */
  const loadMatches = async () => {
    loading.value = true;
    error.value = null;

    try {
      const result = await managerMatchCoverageService.getManagerMatches(
        organizations.value,
        selectedLimit.value
      );
      matches.value = result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load matches';
      matches.value = [];
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
    matches,
    filteredMatches,
    loading,
    error,
    isEmpty,
    selectedKind,
    selectedLimit,
    loadMatches,
    getCoverageDisplay,
    formatDuration,
    formatRelativeDate,
    getNarrationProgress,
  };
};

import { supabase } from '@/lib/supabaseClient';
import type { UserOrganizationSummary } from '@/modules/orgs/types';
import type { MatchWithCoverage, CoverageTier } from '../types/MatchWithCoverage';

const GAP_THRESHOLD_MINUTES = 8;
const MANAGER_ROLES = ['owner', 'manager', 'staff'];

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

/**
 * Service for fetching and enriching matches with coverage data
 */
export const managerMatchCoverageService = {
  /**
   * Fetch matches from all manager organizations with coverage information
   */
  async getManagerMatches(
    managerOrgs: UserOrganizationSummary[],
    limit: number = 5
  ): Promise<MatchWithCoverage[]> {
    // Filter to only manager roles
    const filteredOrgs = managerOrgs.filter(item => 
      MANAGER_ROLES.includes(item.membership.role)
    );

    if (filteredOrgs.length === 0) {
      return [];
    }

    // Fetch matches with coverage data in parallel for all orgs using RPC
    const matchesPromises = filteredOrgs.map(async (orgItem) => {
      const { data, error } = await supabase.rpc('rpc_get_manager_matches_with_coverage', {
        p_org_id: orgItem.organization.id,
        p_limit: limit,
      });

      if (error) {
        console.error(`Failed to fetch matches for org ${orgItem.organization.name}:`, error);
        return [];
      }

      if (!data || data.length === 0) return [];

      // Transform RPC results to MatchWithCoverage
      return data.map((row: any) => {
        const narrationCount = row.narration_count ?? 0;
        const maxGapMinutes = row.max_gap_minutes ?? null;
        const hasLargeGap = maxGapMinutes !== null && maxGapMinutes > GAP_THRESHOLD_MINUTES;

        // Calculate coverage tier
        let coverageTier = getBaseCoverageTier(narrationCount);
        if (hasLargeGap) {
          coverageTier = demoteTier(coverageTier);
        }

        const match: MatchWithCoverage = {
          id: row.media_asset_id,
          orgId: row.org_id,
          orgName: orgItem.organization.name,
          title: row.title ?? row.file_name,
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

        return match;
      });
    });

    const matchesArrays = await Promise.all(matchesPromises);
    const allMatches = matchesArrays.flat();

    // Sort by most recent first
    allMatches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return allMatches.slice(0, limit);
  },
};

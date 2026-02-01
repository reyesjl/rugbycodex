import { supabase } from '@/lib/supabaseClient';
import { mediaService } from '@/modules/media/services/mediaService';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import type { UserOrganizationSummary } from '@/modules/orgs/types';
import type { MatchWithCoverage, CoverageTier } from '../types/MatchWithCoverage';

const GAP_THRESHOLD_MINUTES = 8;
const MANAGER_ROLES = ['owner', 'manager', 'staff'];

type SegmentRow = {
  id: string;
  media_asset_id: string;
  start_seconds: number;
  end_seconds: number;
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

/**
 * Calculate max gap in minutes between consecutive narrated segments
 */
function calculateMaxGapMinutes(segments: SegmentRow[]): number | null {
  if (segments.length < 2) return null;

  // Sort by start_seconds
  const sorted = [...segments].sort((a, b) => a.start_seconds - b.start_seconds);

  let maxGapSeconds = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i]!.start_seconds - sorted[i - 1]!.end_seconds;
    maxGapSeconds = Math.max(maxGapSeconds, gap);
  }

  return maxGapSeconds / 60; // Convert to minutes
}

/**
 * Fetch segments that have narrations for a given media asset
 */
async function fetchNarratedSegments(mediaAssetId: string): Promise<SegmentRow[]> {
  // First get segment IDs that have narrations
  const { data: narrationData, error: narrationError } = await supabase
    .from('narrations')
    .select('media_asset_segment_id')
    .eq('media_asset_id', mediaAssetId);

  if (narrationError) throw narrationError;
  if (!narrationData || narrationData.length === 0) return [];

  // Get unique segment IDs
  const segmentIds = [...new Set(narrationData.map(n => n.media_asset_segment_id))];

  // Fetch segments
  const { data: segmentData, error: segmentError } = await supabase
    .from('media_asset_segments')
    .select('id, media_asset_id, start_seconds, end_seconds')
    .in('id', segmentIds);

  if (segmentError) throw segmentError;
  return segmentData ?? [];
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
    const orgIds = managerOrgs
      .filter(item => MANAGER_ROLES.includes(item.membership.role))
      .map(item => item.organization.id);

    if (orgIds.length === 0) {
      return [];
    }

    // Fetch matches and narration counts in parallel for all orgs
    const matchesPromises = orgIds.map(orgId =>
      mediaService.listByOrganization(orgId, { limit })
    );
    const narrationCountsPromises = orgIds.map(orgId =>
      mediaService.getNarrationCountsByOrg(orgId)
    );

    const [matchesArrays, narrationCountsArrays] = await Promise.all([
      Promise.all(matchesPromises),
      Promise.all(narrationCountsPromises),
    ]);

    // Flatten and combine matches with their org info
    const allMatches: Array<OrgMediaAsset & { orgName: string }> = [];
    matchesArrays.forEach((matches, index) => {
      const orgName = managerOrgs.find(
        item => item.organization.id === orgIds[index]
      )?.organization.name ?? 'Unknown';
      
      matches.forEach(match => {
        allMatches.push({ ...match, orgName });
      });
    });

    // Build narration count map
    const narrationCountMap = new Map<string, number>();
    narrationCountsArrays.forEach(counts => {
      counts.forEach(({ media_asset_id, count }) => {
        narrationCountMap.set(media_asset_id, count);
      });
    });

    // Enrich matches with coverage data
    const enrichedMatches = await Promise.all(
      allMatches.map(async (match) => {
        const narrationCount = narrationCountMap.get(match.id) ?? 0;
        
        // Calculate max gap if there are narrations
        let maxGapMinutes: number | null = null;
        let hasLargeGap = false;

        if (narrationCount > 0) {
          try {
            const segments = await fetchNarratedSegments(match.id);
            maxGapMinutes = calculateMaxGapMinutes(segments);
            hasLargeGap = maxGapMinutes !== null && maxGapMinutes > GAP_THRESHOLD_MINUTES;
          } catch (error) {
            console.error(`Failed to fetch segments for match ${match.id}:`, error);
          }
        }

        // Calculate coverage tier
        let coverageTier = getBaseCoverageTier(narrationCount);
        if (hasLargeGap) {
          coverageTier = demoteTier(coverageTier);
        }

        const enriched: MatchWithCoverage = {
          id: match.id,
          orgId: match.org_id,
          orgName: match.orgName,
          title: match.title ?? match.file_name,
          fileName: match.file_name,
          kind: match.kind,
          durationSeconds: match.duration_seconds,
          createdAt: match.created_at,
          thumbnailPath: match.thumbnail_path,
          narrationCount,
          coverageTier,
          maxGapMinutes,
          hasLargeGap,
        };

        return enriched;
      })
    );

    // Sort by most recent first
    enrichedMatches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return enrichedMatches.slice(0, limit);
  },
};

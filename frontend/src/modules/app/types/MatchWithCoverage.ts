export type CoverageTier = 'not_covered' | 'partial' | 'well_covered' | 'very_well_covered';

export type MatchWithCoverage = {
  id: string;
  orgId: string;
  orgName: string;
  title: string;
  fileName: string;
  kind: string;
  durationSeconds: number;
  createdAt: Date;
  thumbnailPath: string | null;
  narrationCount: number;
  coverageTier: CoverageTier;
  maxGapMinutes: number | null;
  hasLargeGap: boolean;
};

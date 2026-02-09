import type { MatchSummaryState } from '@/modules/analysis/types/MatchSummary';

export type SegmentInsight = {
  state: MatchSummaryState;
  insight_headline?: string | null;
  insight_sentence?: string | null;
  coach_script?: string | null;
};

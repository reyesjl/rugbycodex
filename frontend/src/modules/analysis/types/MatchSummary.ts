export type MatchSummaryState = 'empty' | 'light' | 'normal';

export type MatchSummary = {
  state: MatchSummaryState;
  bullets?: string[];
};

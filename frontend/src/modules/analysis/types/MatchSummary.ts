export type MatchSummaryState = 'empty' | 'light' | 'normal';

export type MatchAnalysisSection = {
  title: string;
  summary: string;
};

export type MatchSummarySections = {
  set_piece?: MatchAnalysisSection | null;
  territory?: MatchAnalysisSection | null;
  possession?: MatchAnalysisSection | null;
  defence?: MatchAnalysisSection | null;
  kick_battle?: MatchAnalysisSection | null;
  scoring?: MatchAnalysisSection | null;
};

export type StructuredMatchSummary = {
  state: MatchSummaryState;
  match_signature?: string[];
  sections?: MatchSummarySections;
};

// Legacy format support
export type MatchSummary = {
  state: MatchSummaryState;
  bullets?: string[];
} | StructuredMatchSummary;

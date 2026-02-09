export type MatchSummaryState = 'empty' | 'light' | 'normal';

export type MatchAnalysisSection = {
  title: string;
  summary: string;
};

export type SummaryRefreshMeta = {
  narration_count_at_generation?: number | null;
  narration_count_current?: number | null;
  is_stale?: boolean | null;
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
  match_headline?: string | null;
  match_summary?: string[];
  sections?: MatchSummarySections;
} & SummaryRefreshMeta;

// Legacy format support
export type MatchSummary = {
  state: MatchSummaryState;
  bullets?: string[];
} & SummaryRefreshMeta | StructuredMatchSummary;

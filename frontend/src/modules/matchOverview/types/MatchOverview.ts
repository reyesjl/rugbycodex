import type { MatchSummaryState } from '@/modules/analysis/types/MatchSummary';

export type MatchSummarySnapshot = {
  state: MatchSummaryState;
  match_headline: string | null;
  match_summary: string[];
  sections: {
    set_piece?: string | null;
    territory?: string | null;
    possession?: string | null;
    defence?: string | null;
    kick_battle?: string | null;
    scoring?: string | null;
  };
  narration_count_at_generation?: number | null;
  generated_at?: string | null;
};

export type MatchMomentumPoint = {
  bucket_start_seconds: number;
  bucket_end_seconds: number;
  segment_count: number;
  narration_count: number;
};

export type MatchThemeDTO = {
  theme_key: string;
  label: string;
  confidence: number | null;
  evidence: {
    tag_keys: string[];
    narration_count: number;
  };
};

export type DistributionDTO = {
  key: string;
  label: string;
  segment_count: number;
  percent: number;
};

export type TacticalPatternsDTO = {
  set_pieces: DistributionDTO[];
  actions: DistributionDTO[];
  transitions: DistributionDTO[];
};

export type PlayerImpactDTO = {
  identity_tag_key: string;
  player_name: string;
  segment_count: number;
  narration_count: number;
  impact_score: number;
  top_actions: string[];
};

export type MatchTrendDTO = {
  metric_key: string;
  current_value: number;
  baseline_value: number;
  delta_value: number;
  direction: 'up' | 'down' | 'flat';
  trend_window: number;
  sample_size: number;
};

export type IntelligenceFeedTag = {
  tag_type: string;
  tag_key: string;
};

export type IntelligenceFeedItemDTO = {
  segment_id: string;
  segment_index: number;
  start_seconds: number;
  end_seconds: number;
  insight_headline: string | null;
  insight_sentence: string | null;
  coach_script: string | null;
  narration_count_at_generation: number | null;
  generated_at: string | null;
  tags: IntelligenceFeedTag[];
};

export type MatchStoryDTO = {
  summary: MatchSummarySnapshot | null;
  momentum_timeline: MatchMomentumPoint[];
  themes: MatchThemeDTO[];
};

export type MatchOverviewDTO = {
  version: 'v1';
  match_id: string;
  org_id: string;
  generated_at: string;
  match: {
    id: string;
    file_name: string;
    created_at: string;
    duration_seconds: number | null;
    kind: string | null;
    thumbnail_path: string | null;
  };
  counts: {
    narration_count: number;
    segment_count: number;
  };
  story: MatchStoryDTO;
  tactical_patterns: TacticalPatternsDTO;
  player_impact: PlayerImpactDTO[];
  trends: MatchTrendDTO[];
  intelligence_feed: IntelligenceFeedItemDTO[];
};

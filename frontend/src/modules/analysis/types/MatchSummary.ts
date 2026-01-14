export type MatchSummary = {
  media_asset_id: string;
  org_id: string;
  bullets: string[];
  narration_count: number;
  model: string | null;
  generated_at: string;
  truncation?: {
    narrations_included: number;
    narrations_total: number;
    text_max_chars: number;
  };
};

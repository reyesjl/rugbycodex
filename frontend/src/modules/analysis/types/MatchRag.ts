export type MatchRagKeyPoint = {
  point: string;
  evidence: string[];
};

export type MatchRagClip = {
  media_segment_id: string;
  reason: string;
  evidence: string[];
  segment_title?: string | null;
  segment_sentence?: string | null;
  media_asset_thumbnail_path?: string | null;
  segment_index?: number | null;
  start_seconds?: number | null;
  end_seconds?: number | null;
};

export type MatchRagResponse = {
  answer: string;
  key_points: MatchRagKeyPoint[];
  recommended_clips: MatchRagClip[];
  confidence?: "low" | "medium" | "high";
  insufficient_evidence?: boolean;
};

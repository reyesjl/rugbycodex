import type { SegmentTagType } from '@/modules/media/types/SegmentTag';

export type SegmentTagSuggestionStatus = 'pending' | 'accepted' | 'rejected';

export type SegmentTagSuggestion = {
  id: string;
  segment_id: string;
  tag_key: string;
  tag_type: SegmentTagType;
  status: SegmentTagSuggestionStatus;
  source: string;
  suggested_by: string;
  decided_by: string | null;
  suggested_at: string;
  decided_at: string | null;
  narration_id: string | null;
  tagged_profile_id: string | null;
};

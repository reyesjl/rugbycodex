export type SegmentTagType = 'action' | 'context' | 'identity';
export type SegmentTagStatus = 'pending' | 'accepted' | 'rejected';

export type SegmentTag = {
  id: string;
  segment_id: string;
  tag_key: string;
  tag_type: SegmentTagType;
  created_by: string;
  created_at: string;
  tagged_profile_id?: string | null;
  status?: SegmentTagStatus | null;
  source?: string | null;
};

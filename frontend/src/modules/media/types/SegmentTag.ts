export type SegmentTagType = 'action' | 'context' | 'identity';

export type SegmentTag = {
  id: string;
  segment_id: string;
  tag_key: string;
  tag_type: SegmentTagType;
  created_by: string;
  created_at: string;
};

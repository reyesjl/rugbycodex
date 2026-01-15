import { supabase } from '@/lib/supabaseClient';
import type { PostgrestError } from '@supabase/supabase-js';
import { requireUserId } from '@/modules/auth/identity';
import type { SegmentTag, SegmentTagType } from '@/modules/media/types/SegmentTag';

type SegmentTagRow = {
  id: string;
  segment_id: string;
  tag_key: string;
  tag_type: SegmentTagType;
  created_by: string | null;
  created_at: string | Date | null;
};

function asIsoString(value: string | Date | null, context: string): string {
  if (!value) {
    throw new Error(`Missing ${context} timestamp.`);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid ${context} timestamp.`);
    }
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${context} timestamp.`);
  }
  return value;
}

function toSegmentTag(row: SegmentTagRow): SegmentTag {
  return {
    id: row.id,
    segment_id: row.segment_id,
    tag_key: row.tag_key,
    tag_type: row.tag_type,
    created_by: row.created_by ?? '',
    created_at: asIsoString(row.created_at, 'tag creation'),
  };
}

export const segmentTagService = {
  async listTagsForSegment(segmentId: string): Promise<SegmentTag[]> {
    if (!segmentId) return [];

    const { data, error } = (await supabase
      .from('segment_tags')
      .select('id, segment_id, tag_key, tag_type, created_by, created_at')
      .eq('segment_id', segmentId)
      .order('created_at', { ascending: true })) as {
      data: SegmentTagRow[] | null;
      error: PostgrestError | null;
    };

    if (error) throw error;
    return (data ?? []).map(toSegmentTag);
  },

  async addTag(params: { segmentId: string; tagKey: string; tagType: SegmentTagType }): Promise<SegmentTag> {
    const userId = requireUserId();
    if (!params.segmentId) throw new Error('Missing segmentId.');
    if (!params.tagKey) throw new Error('Missing tagKey.');
    if (!params.tagType) throw new Error('Missing tagType.');

    const { data, error } = (await supabase
      .from('segment_tags')
      .insert({
        segment_id: params.segmentId,
        tag_key: params.tagKey,
        tag_type: params.tagType,
        created_by: userId,
      })
      .select('id, segment_id, tag_key, tag_type, created_by, created_at')
      .single()) as { data: SegmentTagRow | null; error: PostgrestError | null };

    if (error) throw error;
    if (!data) throw new Error('Failed to create segment tag.');

    return toSegmentTag(data);
  },

  async removeTag(tagId: string): Promise<void> {
    if (!tagId) throw new Error('Missing tagId.');

    const { error } = await supabase
      .from('segment_tags')
      .delete()
      .eq('id', tagId);

    if (error) throw error;
  },
};

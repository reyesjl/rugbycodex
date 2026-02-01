import { supabase } from '@/lib/supabaseClient';
import { requireUserId } from '@/modules/auth/identity';
import type { PostgrestError } from '@supabase/supabase-js';

export type SegmentTag = {
  id: string;
  tag_type: 'action' | 'context' | 'identity';
  tag_key: string;
};

export type UserMoment = {
  tagId: string;
  taggedAt: string;
  segmentId: string;
  startSeconds: number;
  endSeconds: number;
  mediaAssetId: string;
  matchName: string;
  matchDate: string;
  thumbnailPath: string | null;
  orgId: string;
  orgName: string;
  tags: SegmentTag[];
};

export type MomentGroup = {
  mediaAssetId: string;
  matchName: string;
  matchDate: string;
  thumbnailPath: string | null;
  orgId: string;
  orgName: string;
  segments: Array<{
    segmentId: string;
    startSeconds: number;
    endSeconds: number;
    taggedAt: string;
    tags: SegmentTag[];
  }>;
};

export const myMomentsService = {
  /**
   * Fetch all segments where the current user has tagged themselves with an identity tag.
   * Also fetches all other tags (action, context) for those segments.
   * 
   * Returns moments across all organizations the user has access to, ordered by match date (most recent first).
   * 
   * @throws {Error} If user is not authenticated or query fails
   */
  async fetchUserMoments(): Promise<UserMoment[]> {
    const userId = requireUserId();

    // First, get all segment IDs where user has identity tags
    const { data: identityTags, error: identityError } = await supabase
      .from('segment_tags')
      .select(`
        id,
        created_at,
        segment_id,
        media_asset_segments!inner (
          id,
          start_seconds,
          end_seconds,
          media_asset_id,
          media_assets!inner (
            id,
            file_name,
            created_at,
            thumbnail_path,
            org_id,
            organizations!inner (
              id,
              name
            )
          )
        )
      `)
      .eq('tag_type', 'identity')
      .eq('created_by', userId)
      .order('created_at', { ascending: false }) as {
        data: any[] | null;
        error: PostgrestError | null;
      };

    if (identityError) {
      throw new Error(`Failed to fetch user moments: ${identityError.message}`);
    }

    if (!identityTags || identityTags.length === 0) {
      return [];
    }

    // Extract segment IDs
    const segmentIds = identityTags
      .map((row) => row.segment_id)
      .filter(Boolean);

    // Fetch ALL tags for these segments
    const { data: allTags, error: tagsError } = await supabase
      .from('segment_tags')
      .select('id, segment_id, tag_type, tag_key')
      .in('segment_id', segmentIds) as {
        data: any[] | null;
        error: PostgrestError | null;
      };

    if (tagsError) {
      console.warn('Failed to fetch segment tags:', tagsError.message);
    }

    // Group tags by segment ID
    const tagsBySegment = new Map<string, SegmentTag[]>();
    for (const tag of allTags ?? []) {
      const segmentId = String(tag.segment_id);
      if (!tagsBySegment.has(segmentId)) {
        tagsBySegment.set(segmentId, []);
      }
      tagsBySegment.get(segmentId)!.push({
        id: tag.id,
        tag_type: tag.tag_type,
        tag_key: tag.tag_key,
      });
    }

    // Transform nested structure into flat UserMoment objects
    const moments: UserMoment[] = [];
    
    for (const row of identityTags) {
      const segment = row.media_asset_segments;
      const asset = segment?.media_assets;
      const org = asset?.organizations;

      // Skip incomplete data (shouldn't happen with inner joins, but be defensive)
      if (!segment || !asset || !org) continue;

      const segmentId = String(segment.id);
      const tags = tagsBySegment.get(segmentId) ?? [];

      moments.push({
        tagId: row.id,
        taggedAt: row.created_at,
        segmentId,
        startSeconds: segment.start_seconds,
        endSeconds: segment.end_seconds,
        mediaAssetId: asset.id,
        matchName: asset.file_name,
        matchDate: asset.created_at,
        thumbnailPath: asset.thumbnail_path,
        orgId: org.id,
        orgName: org.name,
        tags,
      });
    }

    return moments;
  },

  /**
   * Group moments by media asset (match) and sort by match date (most recent first).
   * 
   * Within each group, segments are sorted by their timestamp within the match.
   */
  groupMomentsByMatch(moments: UserMoment[]): MomentGroup[] {
    const grouped = new Map<string, MomentGroup>();

    for (const moment of moments) {
      let group = grouped.get(moment.mediaAssetId);

      if (!group) {
        group = {
          mediaAssetId: moment.mediaAssetId,
          matchName: moment.matchName,
          matchDate: moment.matchDate,
          thumbnailPath: moment.thumbnailPath,
          orgId: moment.orgId,
          orgName: moment.orgName,
          segments: [],
        };
        grouped.set(moment.mediaAssetId, group);
      }

      group.segments.push({
        segmentId: moment.segmentId,
        startSeconds: moment.startSeconds,
        endSeconds: moment.endSeconds,
        taggedAt: moment.taggedAt,
        tags: moment.tags,
      });
    }

    // Convert to array and sort by match date (most recent first)
    const groups = Array.from(grouped.values());
    groups.sort((a, b) => {
      const dateA = new Date(a.matchDate).getTime();
      const dateB = new Date(b.matchDate).getTime();
      return dateB - dateA;
    });

    // Sort segments within each group by start time
    for (const group of groups) {
      group.segments.sort((a, b) => a.startSeconds - b.startSeconds);
    }

    return groups;
  },
};

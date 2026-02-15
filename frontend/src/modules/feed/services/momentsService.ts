import { supabase } from '@/lib/supabaseClient';
import { requireUserId } from '@/modules/auth/identity';
import type { PostgrestError } from '@supabase/supabase-js';
import type { FeedItem } from '@/modules/feed/types/FeedItem';
import type { SegmentTag } from '@/modules/media/types/SegmentTag';
import { formatMediaAssetNameForDisplay } from '@/modules/media/utils/assetUtilities';

function formatTagKey(key: string): string {
  return key.replace(/_/g, ' ');
}

function formatSegmentTitle(tags: SegmentTag[]): string {
  const actionTags = tags.filter((t) => t.tag_type === 'action').map((t) => formatTagKey(t.tag_key));
  const contextTags = tags.filter((t) => t.tag_type === 'context').map((t) => formatTagKey(t.tag_key));

  if (actionTags.length === 0 && contextTags.length === 0) {
    return 'You in action';
  }

  const parts: string[] = [];
  
  if (actionTags.length > 0) {
    parts.push(actionTags.join(', '));
  }

  if (contextTags.length > 0) {
    parts.push(`(${contextTags.join(', ')})`);
  }

  return `You in ${parts.join(' ')}`;
}

export const momentsService = {
  /**
   * Get all segments from a specific media asset where the current user has an identity tag.
   * 
   * Used by FeedView to display user's moments in a vertical swipe feed.
   * 
   * @param mediaAssetId - The ID of the media asset (match) to filter by
   * @returns Array of FeedItems for segments with user's identity tags, sorted chronologically
   * @throws {Error} If user is not authenticated or query fails
   */
  async getMomentsFeed(mediaAssetId: string): Promise<FeedItem[]> {
    const userId = requireUserId();

    if (!mediaAssetId) {
      throw new Error('Media asset ID is required.');
    }

    // First, get segments where user has identity tags
    const { data: identityData, error: identityError } = await supabase
      .from('media_asset_segments')
      .select(`
        id,
        media_asset_id,
        segment_index,
        start_seconds,
        end_seconds,
        created_at,
        media_assets!inner (
          id,
          bucket,
          file_name,
          created_at,
          org_id,
          organizations!inner (
            id,
            name
          )
        ),
        segment_tags!inner (
          id,
          tag_type,
          tag_key,
          created_by,
          created_at,
          tagged_profile_id
        )
      `)
      .eq('media_asset_id', mediaAssetId)
      .eq('segment_tags.tag_type', 'identity')
      .eq('segment_tags.tagged_profile_id', userId)
      .order('start_seconds', { ascending: true }) as {
        data: any[] | null;
        error: PostgrestError | null;
      };

    if (identityError) {
      throw new Error(`Failed to fetch moments: ${identityError.message}`);
    }

    if (!identityData || identityData.length === 0) {
      return [];
    }

    // Get segment IDs
    const segmentIds = identityData.map((row) => row.id);

    // Fetch ALL tags for these segments (not just identity)
    const { data: allTags, error: tagsError } = await supabase
      .from('segment_tags')
      .select('id, segment_id, tag_type, tag_key, created_by, created_at, tagged_profile_id, status, source')
      .in('segment_id', segmentIds) as {
        data: any[] | null;
        error: PostgrestError | null;
      };

    if (tagsError) {
      console.warn('Failed to fetch all tags:', tagsError.message);
    }

    // Group tags by segment
    const tagsBySegment = new Map<string, SegmentTag[]>();
    for (const tag of allTags ?? []) {
      const segmentId = String(tag.segment_id);
      if (!tagsBySegment.has(segmentId)) {
        tagsBySegment.set(segmentId, []);
      }
      tagsBySegment.get(segmentId)!.push({
        id: tag.id,
        segment_id: tag.segment_id,
        tag_key: tag.tag_key,
        tag_type: tag.tag_type as any,
        created_by: tag.created_by,
        created_at: tag.created_at,
        tagged_profile_id: tag.tagged_profile_id ?? null,
        status: tag.status ?? null,
        source: tag.source ?? null,
      });
    }

    // Transform rows to FeedItems
    const feedItems: FeedItem[] = [];
    
    for (const row of identityData) {
      // Validate structure (defensive check)
      if (!row.media_assets || !row.media_assets.organizations) {
        console.warn('[momentsService] Skipping row with incomplete data:', row.id);
        continue;
      }

      // Use all tags for this segment
      const allSegmentTags = tagsBySegment.get(String(row.id)) ?? [];
      
      // Build FeedItem with all tags
      const asset = row.media_assets;
      const org = asset.organizations;
      const matchDate = new Date(asset.created_at);
      
      const title = formatSegmentTitle(allSegmentTags);
      const normalizedFileName = formatMediaAssetNameForDisplay(asset.file_name);
      const dateLabel = Number.isNaN(matchDate.getTime()) ? '' : matchDate.toLocaleDateString();
      const metaLine = dateLabel ? `${normalizedFileName} • ${dateLabel}` : normalizedFileName;

      feedItems.push({
        id: row.id,
        orgId: org.id,
        orgName: org.name,
        mediaAssetId: asset.id,
        bucket: asset.bucket,
        mediaAssetSegmentId: row.id,
        segmentIndex: row.segment_index,
        startSeconds: row.start_seconds,
        endSeconds: row.end_seconds,
        title,
        metaLine,
        createdAt: new Date(row.created_at),
        segment: {
          id: row.id,
          media_asset_id: row.media_asset_id,
          segment_index: row.segment_index,
          start_seconds: row.start_seconds,
          end_seconds: row.end_seconds,
          created_at: new Date(row.created_at),
          tags: allSegmentTags,
        },
      });
    }

    return feedItems;
  },
};

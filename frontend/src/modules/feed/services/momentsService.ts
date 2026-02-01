import { supabase } from '@/lib/supabaseClient';
import { requireUserId } from '@/modules/auth/identity';
import type { PostgrestError } from '@supabase/supabase-js';
import type { FeedItem } from '@/modules/feed/types/FeedItem';
import type { SegmentTag } from '@/modules/media/types/SegmentTag';

type MomentsQueryRow = {
  id: string;
  media_asset_id: string;
  segment_index: number;
  start_seconds: number;
  end_seconds: number;
  created_at: string;
  media_assets: {
    id: string;
    bucket: string;
    file_name: string;
    created_at: string;
    org_id: string;
    organizations: {
      id: string;
      name: string;
    };
  };
  segment_tags: Array<{
    id: string;
    tag_type: string;
    tag_key: string;
    created_by: string;
    created_at: string;
  }>;
};

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function toFeedItem(row: MomentsQueryRow): FeedItem {
  const asset = row.media_assets;
  const org = asset.organizations;
  const matchDate = new Date(asset.created_at);
  
  const timestamp = formatTimestamp(row.start_seconds);
  const title = `Your moment at ${timestamp}`;
  const dateLabel = Number.isNaN(matchDate.getTime()) ? '' : matchDate.toLocaleDateString();
  const metaLine = dateLabel ? `${asset.file_name} • ${dateLabel}` : asset.file_name;

  const tags: SegmentTag[] = row.segment_tags.map((tag) => ({
    id: tag.id,
    segment_id: row.id,
    tag_key: tag.tag_key,
    tag_type: tag.tag_type as any,
    created_by: tag.created_by,
    created_at: tag.created_at,
  }));

  return {
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
      tags,
    },
  };
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

    const { data, error } = await supabase
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
          created_at
        )
      `)
      .eq('media_asset_id', mediaAssetId)
      .eq('segment_tags.tag_type', 'identity')
      .eq('segment_tags.created_by', userId)
      .order('start_seconds', { ascending: true }) as {
        data: any[] | null;
        error: PostgrestError | null;
      };

    if (error) {
      throw new Error(`Failed to fetch moments: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Transform rows to FeedItems
    const feedItems: FeedItem[] = [];
    
    for (const row of data) {
      // Validate structure (defensive check)
      if (!row.media_assets || !row.media_assets.organizations) {
        console.warn('[momentsService] Skipping row with incomplete data:', row.id);
        continue;
      }

      feedItems.push(toFeedItem(row as MomentsQueryRow));
    }

    return feedItems;
  },
};

import { supabase } from '@/lib/supabaseClient';
import { requireUserId } from '@/modules/auth/identity';
import type { PostgrestError } from '@supabase/supabase-js';
import type {
  Playlist,
  PlaylistSegment,
  PlaylistTag,
  PlaylistListItem,
  PlaylistFeedEntry,
} from '../types';

/**
 * Service layer for playlist data access and mutation.
 *
 * Responsibility:
 * - Encapsulates all playlist-related I/O.
 * - Follows existing service patterns from narrationService and assignmentsService.
 *
 * This service does NOT:
 * - Hold state
 * - Perform permission checks beyond API shape (RLS handles auth)
 * - Derive UI logic
 *
 * Authorization is enforced via Supabase RLS.
 */

type PlaylistRow = {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  description: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type PlaylistSegmentRow = {
  id: string;
  playlist_id: string;
  media_segment_id: string;
  sort_order: number;
  created_at: string | Date;
};

type PlaylistTagRow = {
  id: string;
  playlist_id: string;
  tag_key: string;
  created_by: string;
  created_at: string | Date;
};

type SingleQueryResult<T = unknown> = PromiseLike<{ data: T | null; error: PostgrestError | null }>;
type ListQueryResult<T = unknown> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

function asDate(value: string | Date, context: string): Date {
  if (!value) {
    throw new Error(`Missing ${context} timestamp.`);
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${context} timestamp.`);
  }
  return parsed;
}

async function getSingle<T = PlaylistRow>(
  query: SingleQueryResult<T>,
  notFoundMessage: string
): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  if (!data) throw new Error(notFoundMessage);
  return data;
}

async function getList<T = PlaylistRow>(query: ListQueryResult<T>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

function toPlaylist(row: PlaylistRow): Playlist {
  return {
    id: row.id,
    org_id: row.org_id,
    created_by: row.created_by,
    name: row.name,
    description: row.description,
    created_at: asDate(row.created_at, 'created_at'),
    updated_at: asDate(row.updated_at, 'updated_at'),
  };
}

function toPlaylistSegment(row: PlaylistSegmentRow): PlaylistSegment {
  return {
    id: row.id,
    playlist_id: row.playlist_id,
    media_segment_id: row.media_segment_id,
    sort_order: row.sort_order,
    created_at: asDate(row.created_at, 'created_at'),
  };
}

function toPlaylistTag(row: PlaylistTagRow): PlaylistTag {
  return {
    id: row.id,
    playlist_id: row.playlist_id,
    tag_key: row.tag_key,
    created_by: row.created_by,
    created_at: asDate(row.created_at, 'created_at'),
  };
}

export const playlistService = {
  /**
   * Creates a new playlist for an organization.
   *
   * Authorization:
   * - RLS enforces that only owner/manager/staff can create playlists.
   *
   * @param input Playlist creation parameters.
   * @returns The created playlist.
   */
  async createPlaylist(input: {
    orgId: string;
    name: string;
    description?: string | null;
  }): Promise<Playlist> {
    const createdBy = requireUserId();

    const row = await getSingle<PlaylistRow>(
      supabase
        .from('playlists')
        .insert({
          org_id: input.orgId,
          created_by: createdBy,
          name: input.name,
          description: input.description ?? null,
        })
        .select('*')
        .single(),
      'Failed to create playlist.'
    );

    return toPlaylist(row);
  },

  /**
   * Lists all playlists for an organization.
   *
   * Authorization:
   * - RLS enforces org membership for visibility.
   *
   * @param orgId The organization ID.
   * @returns List of playlists.
   */
  async listPlaylistsForOrg(orgId: string): Promise<PlaylistListItem[]> {
    const rows = await getList<PlaylistRow>(
      supabase
        .from('playlists')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
    );

    if (rows.length === 0) return [];

    const playlistIds = rows.map((r) => r.id);

    // Fetch segment counts
    const { data: segmentCounts, error: segmentError } = await supabase
      .from('playlist_segments')
      .select('playlist_id')
      .in('playlist_id', playlistIds);

    if (segmentError) throw segmentError;

    const countByPlaylist = new Map<string, number>();
    for (const seg of segmentCounts ?? []) {
      const id = (seg as any).playlist_id as string;
      countByPlaylist.set(id, (countByPlaylist.get(id) ?? 0) + 1);
    }

    // Fetch tags
    const { data: tagsData, error: tagsError } = await supabase
      .from('playlist_tags')
      .select('*')
      .in('playlist_id', playlistIds);

    if (tagsError) throw tagsError;

    const tagsByPlaylist = new Map<string, PlaylistTag[]>();
    for (const tagRow of (tagsData ?? []) as PlaylistTagRow[]) {
      const existing = tagsByPlaylist.get(tagRow.playlist_id) ?? [];
      existing.push(toPlaylistTag(tagRow));
      tagsByPlaylist.set(tagRow.playlist_id, existing);
    }

    return rows.map((row) => ({
      ...toPlaylist(row),
      segment_count: countByPlaylist.get(row.id) ?? 0,
      tags: tagsByPlaylist.get(row.id) ?? [],
    }));
  },

  /**
   * Gets a single playlist by ID.
   *
   * @param playlistId The playlist ID.
   * @returns The playlist.
   */
  async getPlaylist(playlistId: string): Promise<Playlist> {
    const row = await getSingle<PlaylistRow>(
      supabase.from('playlists').select('*').eq('id', playlistId).single(),
      'Playlist not found.'
    );

    return toPlaylist(row);
  },

  /**
   * Updates a playlist.
   *
   * Authorization:
   * - RLS enforces that only owner/manager/staff can update.
   *
   * @param playlistId The playlist ID.
   * @param updates The fields to update.
   * @returns The updated playlist.
   */
  async updatePlaylist(
    playlistId: string,
    updates: {
      name?: string;
      description?: string | null;
    }
  ): Promise<Playlist> {
    const row = await getSingle<PlaylistRow>(
      supabase
        .from('playlists')
        .update({
          name: updates.name,
          description: updates.description,
        })
        .eq('id', playlistId)
        .select('*')
        .single(),
      'Failed to update playlist.'
    );

    return toPlaylist(row);
  },

  /**
   * Deletes a playlist.
   *
   * Authorization:
   * - RLS enforces that only owner/manager/staff can delete.
   *
   * @param playlistId The playlist ID.
   */
  async deletePlaylist(playlistId: string): Promise<void> {
    const { error } = await supabase.from('playlists').delete().eq('id', playlistId);

    if (error) throw error;
  },

  /**
   * Adds a segment to a playlist.
   *
   * @param playlistId The playlist ID.
   * @param segmentId The media segment ID.
   * @param positionIndex Optional position (defaults to end of list).
   */
  async addSegmentToPlaylist(
    playlistId: string,
    segmentId: string,
    positionIndex?: number
  ): Promise<PlaylistSegment> {
    // If no position provided, get the max position and add 1
    let finalPosition = positionIndex ?? 0;
    if (positionIndex === undefined) {
      const { data: segments } = await supabase
        .from('playlist_segments')
        .select('sort_order')
        .eq('playlist_id', playlistId)
        .order('sort_order', { ascending: false })
        .limit(1);

      if (segments && segments.length > 0) {
        finalPosition = ((segments[0] as any).sort_order as number) + 1;
      }
    }

    const row = await getSingle<PlaylistSegmentRow>(
      supabase
        .from('playlist_segments')
        .insert({
          playlist_id: playlistId,
          media_segment_id: segmentId,
          sort_order: finalPosition,
        })
        .select('*')
        .single(),
      'Failed to add segment to playlist.'
    );

    return toPlaylistSegment(row);
  },

  /**
   * Removes a segment from a playlist.
   *
   * @param playlistId The playlist ID.
   * @param segmentId The media segment ID.
   */
  async removeSegmentFromPlaylist(playlistId: string, segmentId: string): Promise<void> {
    const { error } = await supabase
      .from('playlist_segments')
      .delete()
      .eq('playlist_id', playlistId)
      .eq('media_segment_id', segmentId);

    if (error) throw error;
  },

  /**
   * Reorders playlist segments by updating their positions.
   *
   * @param playlistId The playlist ID.
   * @param orderedSegmentIds Array of segment IDs in desired order.
   */
  async reorderPlaylistSegments(playlistId: string, orderedSegmentIds: string[]): Promise<void> {
    // Update each segment's position
    const updates = orderedSegmentIds.map((segmentId, index) => ({
      playlist_id: playlistId,
      media_segment_id: segmentId,
      sort_order: index,
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('playlist_segments')
        .update({ sort_order: update.sort_order })
        .eq('playlist_id', update.playlist_id)
        .eq('media_segment_id', update.media_segment_id);

      if (error) throw error;
    }
  },

  /**
   * Gets segments for a playlist ordered by position.
   *
   * @param playlistId The playlist ID.
   * @returns List of playlist segments.
   */
  async listPlaylistSegments(playlistId: string): Promise<PlaylistSegment[]> {
    const rows = await getList<PlaylistSegmentRow>(
      supabase
        .from('playlist_segments')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('sort_order', { ascending: true })
    );

    return rows.map(toPlaylistSegment);
  },

  /**
   * Gets the playlist feed using optimized RPC.
   * Returns segments with full media asset details ordered by position.
   *
   * @param playlistId The playlist ID.
   * @param orgId The organization ID.
   * @returns List of playlist feed entries.
   */
  async getPlaylistFeed(playlistId: string, orgId: string): Promise<PlaylistFeedEntry[]> {
    const { data, error } = await supabase.rpc('rpc_get_playlist_feed', {
      p_playlist_id: playlistId,
      p_org_id: orgId,
    });

    if (error) throw error;
    if (!data) return [];

    return (data as any[]).map((row) => ({
      playlist_segment_id: row.playlist_segment_id,
      segment_id: row.segment_id,
      segment_index: row.segment_index,
      start_seconds: row.start_seconds,
      end_seconds: row.end_seconds,
      segment_created_at: asDate(row.segment_created_at, 'segment_created_at'),
      sort_order: row.sort_order,
      media_asset_id: row.media_asset_id,
      media_asset_org_id: row.media_asset_org_id,
      media_asset_uploader_id: row.media_asset_uploader_id,
      media_asset_bucket: row.media_asset_bucket,
      media_asset_storage_path: row.media_asset_storage_path,
      media_asset_streaming_ready: row.media_asset_streaming_ready,
      media_asset_thumbnail_path: row.media_asset_thumbnail_path,
      media_asset_file_size_bytes: row.media_asset_file_size_bytes,
      media_asset_mime_type: row.media_asset_mime_type,
      media_asset_duration_seconds: row.media_asset_duration_seconds,
      media_asset_checksum: row.media_asset_checksum,
      media_asset_source: row.media_asset_source,
      media_asset_file_name: row.media_asset_file_name,
      media_asset_kind: row.media_asset_kind,
      media_asset_status: row.media_asset_status,
      media_asset_created_at: asDate(row.media_asset_created_at, 'media_asset_created_at'),
      media_asset_base_org_storage_path: row.media_asset_base_org_storage_path,
    }));
  },

  /**
   * Adds a tag to a playlist.
   *
   * @param playlistId The playlist ID.
   * @param tagKey The tag key.
   */
  async addTagToPlaylist(playlistId: string, tagKey: string): Promise<PlaylistTag> {
    const createdBy = requireUserId();

    const row = await getSingle<PlaylistTagRow>(
      supabase
        .from('playlist_tags')
        .insert({
          playlist_id: playlistId,
          tag_key: tagKey,
          created_by: createdBy,
        })
        .select('*')
        .single(),
      'Failed to add tag to playlist.'
    );

    return toPlaylistTag(row);
  },

  /**
   * Removes a tag from a playlist.
   *
   * @param tagId The tag ID.
   */
  async removeTagFromPlaylist(tagId: string): Promise<void> {
    const { error } = await supabase.from('playlist_tags').delete().eq('id', tagId);

    if (error) throw error;
  },

  /**
   * Gets all tags for a playlist.
   *
   * @param playlistId The playlist ID.
   * @returns List of tags.
   */
  async getPlaylistTags(playlistId: string): Promise<PlaylistTag[]> {
    const rows = await getList<PlaylistTagRow>(
      supabase
        .from('playlist_tags')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('created_at', { ascending: true })
    );

    return rows.map(toPlaylistTag);
  },
};

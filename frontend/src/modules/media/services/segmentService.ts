import { supabase } from '@/lib/supabaseClient';
import type { PostgrestError } from '@supabase/supabase-js';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';
import { requireUserId } from '@/modules/auth/identity';

type SegmentRow = {
  id: string;
  media_asset_id: string;
  segment_index: number;
  start_seconds: number;
  end_seconds: number;
  created_at: string | Date | null;
  media_assets:
    | {
        id: string;
        org_id: string;
        uploader_id: string;
        bucket: string;
        storage_path: string;
        streaming_ready: boolean;
        thumbnail_path: string | null;
        file_size_bytes: number;
        mime_type: string;
        duration_seconds: number;
        checksum: string;
        source: string;
        file_name: string;
        kind: string;
        status: string;
        created_at: string | Date | null;
        base_org_storage_path: string;
      }
    | null;
};

type MediaAssetRow = {
  id: string;
  org_id: string;
  uploader_id: string;
  bucket: string;
  storage_path: string;
  streaming_ready: boolean;
  thumbnail_path: string | null;
  file_size_bytes: number;
  mime_type: string;
  duration_seconds: number;
  checksum: string;
  source: string;
  file_name: string;
  kind: string;
  status: string;
  created_at: string | Date | null;
  base_org_storage_path: string;
};

type SegmentOnlyRow = {
  id: string;
  media_asset_id: string;
  segment_index: number;
  start_seconds: number;
  end_seconds: number;
  created_at: string | Date | null;
};

type SegmentDetailRow = SegmentOnlyRow & {
  source_type?: string | null;
  created_by_profile_id?: string | null;
};

export type OrgSegmentFeedItem = {
  segment: MediaAssetSegment;
  asset: OrgMediaAsset;
};

function asDate(value: string | Date | null, context: string): Date {
  if (!value) {
    throw new Error(`Missing ${context} timestamp.`);
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${context} timestamp.`);
  }
  return parsed;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx] ?? null;
}

export const segmentService = {
  async listSegmentsForMediaAsset(mediaAssetId: string): Promise<MediaAssetSegment[]> {
    if (!mediaAssetId) return [];

    const { data, error } = (await supabase
      .from('media_asset_segments')
      .select(
        'id, media_asset_id, segment_index, start_seconds, end_seconds, created_at, source_type, created_by_profile_id'
      )
      .eq('media_asset_id', mediaAssetId)
      .order('start_seconds', { ascending: true })) as {
      data: SegmentDetailRow[] | null;
      error: PostgrestError | null;
    };

    if (error) throw error;
    const rows = data ?? [];

    return rows.map((row) => {
      const segment: MediaAssetSegment = {
        id: row.id,
        media_asset_id: row.media_asset_id,
        segment_index: row.segment_index,
        start_seconds: row.start_seconds,
        end_seconds: row.end_seconds,
        created_at: asDate(row.created_at, 'segment creation'),
        source_type: (row.source_type as any) ?? null,
        created_by_profile_id: (row.created_by_profile_id as any) ?? null,
      };
      return segment;
    });
  },

  async createSegment(input: {
    mediaAssetId: string;
    startSeconds: number;
    endSeconds: number;
    sourceType: MediaAssetSegment['source_type'];
  }): Promise<MediaAssetSegment> {
    const userId = requireUserId();
    if (!input.mediaAssetId) throw new Error('Missing mediaAssetId.');
    if (!input.sourceType) throw new Error('Missing sourceType.');

    const startSeconds = Math.max(0, input.startSeconds ?? 0);
    const endSeconds = Math.max(startSeconds, input.endSeconds ?? startSeconds);

    // Compute next segment_index (best-effort; DB triggers may override).
    const { data: lastRow, error: lastErr } = (await supabase
      .from('media_asset_segments')
      .select('segment_index')
      .eq('media_asset_id', input.mediaAssetId)
      .order('segment_index', { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { segment_index: number } | null; error: PostgrestError | null };
    if (lastErr) throw lastErr;
    const nextIndex = (lastRow?.segment_index ?? -1) + 1;

    const { data, error } = (await supabase
      .from('media_asset_segments')
      .insert({
        media_asset_id: input.mediaAssetId,
        segment_index: nextIndex,
        start_seconds: startSeconds,
        end_seconds: endSeconds,
        source_type: input.sourceType,
        created_by_profile_id: userId,
      })
      .select(
        'id, media_asset_id, segment_index, start_seconds, end_seconds, created_at, source_type, created_by_profile_id'
      )
      .single()) as { data: SegmentDetailRow | null; error: PostgrestError | null };

    if (error) throw error;
    if (!data) throw new Error('Failed to create segment.');

    return {
      id: data.id,
      media_asset_id: data.media_asset_id,
      segment_index: data.segment_index,
      start_seconds: data.start_seconds,
      end_seconds: data.end_seconds,
      created_at: asDate(data.created_at, 'segment creation'),
      source_type: (data.source_type as any) ?? input.sourceType,
      created_by_profile_id: (data.created_by_profile_id as any) ?? userId,
    };
  },

  async createCoachSegment(input: {
    mediaAssetId: string;
    startSeconds: number;
    endSeconds: number;
  }): Promise<MediaAssetSegment> {
    return this.createSegment({
      ...input,
      sourceType: 'coach',
    });
  },

  async createMemberSegment(input: {
    mediaAssetId: string;
    startSeconds: number;
    endSeconds: number;
  }): Promise<MediaAssetSegment> {
    return this.createSegment({
      ...input,
      sourceType: 'member',
    });
  },

  async listFeedItemsForOrg(
    orgId: string,
    options?: { maxRows?: number }
  ): Promise<OrgSegmentFeedItem[]> {
    const maxRows = options?.maxRows ?? 100;

    const query = supabase
      .from('media_asset_segments')
      .select(
        `
        id,
        media_asset_id,
        segment_index,
        start_seconds,
        end_seconds,
        created_at,
        media_assets (
          id,
          org_id,
          uploader_id,
          bucket,
          storage_path,
          streaming_ready,
          thumbnail_path,
          file_size_bytes,
          mime_type,
          duration_seconds,
          checksum,
          source,
          file_name,
          kind,
          status,
          created_at,
          base_org_storage_path
        )
      `
      )
      .eq('media_assets.org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(maxRows);

    const { data, error } = (await query) as { data: SegmentRow[] | null; error: PostgrestError | null };
    if (error) throw error;

    const rows = data ?? [];

    return rows
      .filter((row) => !!row.media_assets)
      .map((row) => {
        const assetRow = row.media_assets!;

        const asset: OrgMediaAsset = {
          id: assetRow.id,
          org_id: assetRow.org_id,
          uploader_id: assetRow.uploader_id,
          bucket: assetRow.bucket,
          storage_path: assetRow.storage_path,
          streaming_ready: assetRow.streaming_ready,
          thumbnail_path: assetRow.thumbnail_path ?? null,
          file_size_bytes: assetRow.file_size_bytes,
          mime_type: assetRow.mime_type,
          duration_seconds: assetRow.duration_seconds,
          checksum: assetRow.checksum,
          source: assetRow.source,
          file_name: assetRow.file_name,
          title: null,
          kind: assetRow.kind,
          status: assetRow.status,
          created_at: asDate(assetRow.created_at, 'media asset creation'),
          base_org_storage_path: assetRow.base_org_storage_path,
        };

        const segment: MediaAssetSegment = {
          id: row.id,
          media_asset_id: row.media_asset_id,
          segment_index: row.segment_index,
          start_seconds: row.start_seconds,
          end_seconds: row.end_seconds,
          created_at: asDate(row.created_at, 'segment creation'),
        };

        return { asset, segment };
      });
  },

  async getRandomFeedItemsForOrg(orgId: string, count = 25): Promise<OrgSegmentFeedItem[]> {
    // IMPORTANT: randomize media_assets first (org-scoped), then pick ONE random segment per asset.
    const MAX_ASSET_ROWS = 100;
    const MAX_SEGMENT_ROWS_PER_ASSET = 250;

    const { data: assetData, error: assetError } = (await supabase
      .from('media_assets')
      .select(
        `
        id,
        org_id,
        uploader_id,
        bucket,
        storage_path,
        streaming_ready,
        thumbnail_path,
        file_size_bytes,
        mime_type,
        duration_seconds,
        checksum,
        source,
        file_name,
        kind,
        status,
        created_at,
        base_org_storage_path
      `
      )
      .eq('org_id', orgId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(MAX_ASSET_ROWS)) as { data: MediaAssetRow[] | null; error: PostgrestError | null };

    if (assetError) throw assetError;

    const assets = assetData ?? [];
    if (assets.length === 0) return [];

    // Shuffle assets client-side (equivalent to ORDER BY random()).
    const shuffledAssets = [...assets];
    shuffleInPlace(shuffledAssets);

    const results: OrgSegmentFeedItem[] = [];

    for (const assetRow of shuffledAssets) {
      if (results.length >= count) break;

      const { data: segData, error: segError } = (await supabase
        .from('media_asset_segments')
        .select('id, media_asset_id, segment_index, start_seconds, end_seconds, created_at')
        .eq('media_asset_id', assetRow.id)
        .order('created_at', { ascending: false })
        .limit(MAX_SEGMENT_ROWS_PER_ASSET)) as {
        data: SegmentOnlyRow[] | null;
        error: PostgrestError | null;
      };

      if (segError) throw segError;
      const segments = segData ?? [];
      if (segments.length === 0) continue;

      const chosenSegment = pickRandom(segments);
      if (!chosenSegment) continue;

      const asset: OrgMediaAsset = {
        id: assetRow.id,
        org_id: assetRow.org_id,
        uploader_id: assetRow.uploader_id,
        bucket: assetRow.bucket,
        storage_path: assetRow.storage_path,
        streaming_ready: assetRow.streaming_ready,
        thumbnail_path: assetRow.thumbnail_path ?? null,
        file_size_bytes: assetRow.file_size_bytes,
        mime_type: assetRow.mime_type,
        duration_seconds: assetRow.duration_seconds,
        checksum: assetRow.checksum,
        source: assetRow.source,
        file_name: assetRow.file_name,
        title: null,
        kind: assetRow.kind,
        status: assetRow.status,
        created_at: asDate(assetRow.created_at, 'media asset creation'),
        base_org_storage_path: assetRow.base_org_storage_path,
      };

      const segment: MediaAssetSegment = {
        id: chosenSegment.id,
        media_asset_id: chosenSegment.media_asset_id,
        segment_index: chosenSegment.segment_index,
        start_seconds: chosenSegment.start_seconds,
        end_seconds: chosenSegment.end_seconds,
        created_at: asDate(chosenSegment.created_at, 'segment creation'),
      };

      results.push({ asset, segment });
    }

    return results;
  },
};

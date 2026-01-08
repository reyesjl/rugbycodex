import { supabase } from '@/lib/supabaseClient';
import type { PostgrestError } from '@supabase/supabase-js';
import type { MediaAssetSegment } from '@/modules/narrations/types/MediaAssetSegment';
import type { OrgMediaAsset } from '@/modules/media/types/OrgMediaAsset';

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

export const segmentService = {
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

  async getRandomFeedItemsForOrg(orgId: string, count = 3): Promise<OrgSegmentFeedItem[]> {
    const items = await this.listFeedItemsForOrg(orgId, { maxRows: 100 });
    if (items.length <= count) return items;
    const copy = [...items];
    shuffleInPlace(copy);
    return copy.slice(0, count);
  },
};

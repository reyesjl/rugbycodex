import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { logEvent } from './observability.ts';

export interface MediaAssetFields {
  id?: string;
  org_id: string;
  uploader_id: string;
  bucket?: string;
  storage_path?: string;
  file_size_bytes?: number;
  mime_type?: string;
  duration_seconds?: number;
  checksum?: string;
  source?: string;
  file_name: string;
  status?: string;
  base_org_storage_path: string;
}

export async function insertMediaAsset(
  fields: MediaAssetFields,
  supabase: SupabaseClient,
  requestId?: string,
) {
  const { data, error } = await supabase
    .from('media_assets')
    .insert({
      org_id: fields.org_id,
      uploader_id: fields.uploader_id,
      bucket: fields.bucket ?? 'rugbycodex',
      storage_path: fields.storage_path ?? '',
      file_size_bytes: fields.file_size_bytes ?? 0,
      mime_type: fields.mime_type ?? 'video/mp4',
      duration_seconds: fields.duration_seconds ?? 0,
      checksum: fields.checksum ?? 'TODO',
      source: fields.source ?? 'upload',
      file_name: fields.file_name,
      status: fields.status ?? 'ready',
      base_org_storage_path: fields.base_org_storage_path,
    })
    .select()
    .single();

  if (error) {
    logEvent({
      severity: 'error',
      event_type: 'media_asset_insert_failed',
      request_id: requestId,
      org_id: fields.org_id,
      user_id: fields.uploader_id,
      error_code: 'SUPABASE_WRITE_FAILED',
      error_message: error.message,
    });
    throw new Error(`Failed to insert media asset: ${error.message}`);
  }

  return data;
}
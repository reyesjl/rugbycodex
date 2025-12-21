import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

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
}

export async function insertMediaAsset(
  fields: MediaAssetFields,
  supabase: SupabaseClient
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
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting media asset:', error);
    throw new Error(`Failed to insert media asset: ${error.message}`);
  }

  return data;
}
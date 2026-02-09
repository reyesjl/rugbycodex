-- Fix for RPC function type mismatch
-- Run this in Supabase SQL Editor to update the function with correct enum types

-- Drop the existing function
DROP FUNCTION IF EXISTS public.rpc_get_playlist_feed(uuid, uuid);

-- Recreate with correct types
CREATE OR REPLACE FUNCTION public.rpc_get_playlist_feed(
  p_playlist_id uuid,
  p_org_id uuid
)
RETURNS TABLE (
  playlist_segment_id uuid,
  segment_id uuid,
  segment_index integer,
  start_seconds double precision,
  end_seconds double precision,
  segment_created_at timestamp with time zone,
  sort_order integer,
  media_asset_id uuid,
  media_asset_org_id uuid,
  media_asset_uploader_id uuid,
  media_asset_bucket text,
  media_asset_storage_path text,
  media_asset_streaming_ready boolean,
  media_asset_thumbnail_path text,
  media_asset_file_size_bytes bigint,
  media_asset_mime_type text,
  media_asset_duration_seconds double precision,
  media_asset_checksum text,
  media_asset_source text,
  media_asset_file_name text,
  media_asset_kind media_asset_kind,
  media_asset_status media_asset_status,
  media_asset_created_at timestamp with time zone,
  media_asset_base_org_storage_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.id AS playlist_segment_id,
    mas.id AS segment_id,
    mas.segment_index,
    mas.start_seconds,
    mas.end_seconds,
    mas.created_at AS segment_created_at,
    ps.sort_order,
    ma.id AS media_asset_id,
    ma.org_id AS media_asset_org_id,
    ma.uploader_id AS media_asset_uploader_id,
    ma.bucket AS media_asset_bucket,
    ma.storage_path AS media_asset_storage_path,
    ma.streaming_ready AS media_asset_streaming_ready,
    ma.thumbnail_path AS media_asset_thumbnail_path,
    ma.file_size_bytes AS media_asset_file_size_bytes,
    ma.mime_type AS media_asset_mime_type,
    ma.duration_seconds AS media_asset_duration_seconds,
    ma.checksum AS media_asset_checksum,
    ma.source AS media_asset_source,
    ma.file_name AS media_asset_file_name,
    ma.kind AS media_asset_kind,
    ma.status AS media_asset_status,
    ma.created_at AS media_asset_created_at,
    ma.base_org_storage_path AS media_asset_base_org_storage_path
  FROM public.playlist_segments ps
  INNER JOIN public.media_asset_segments mas ON mas.id = ps.media_segment_id
  INNER JOIN public.media_assets ma ON ma.id = mas.media_asset_id
  INNER JOIN public.playlists p ON p.id = ps.playlist_id
  WHERE ps.playlist_id = p_playlist_id
    AND p.org_id = p_org_id
    AND ma.org_id = p_org_id
  ORDER BY ps.sort_order ASC, ps.created_at ASC;
END;
$$;

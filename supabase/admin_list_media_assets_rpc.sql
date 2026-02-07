-- =============================================
-- Admin List Media Assets RPC
-- =============================================
-- Purpose: 
--   Returns all media assets with org and uploader details for admin review.
--   Includes search filtering and status/kind filtering.
--
-- Security:
--   - SECURITY DEFINER: Runs with owner privileges
--   - Explicit admin check: Only allows profiles with role = 'admin'
--
-- Parameters:
--   p_search_query TEXT - Optional search term for filename, org, or uploader
--   p_status TEXT - Optional filter by status
--   p_kind TEXT - Optional filter by kind (match/training)
--
-- Returns:
--   Table with media asset details including org and uploader info
-- =============================================

CREATE OR REPLACE FUNCTION admin_list_media_assets_rpc(
  p_search_query TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_kind TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  org_id UUID,
  org_name TEXT,
  uploader_id UUID,
  uploader_name TEXT,
  uploader_username TEXT,
  status TEXT,
  processing_stage TEXT,
  kind TEXT,
  file_name TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  duration_seconds DOUBLE PRECISION,
  storage_path TEXT,
  bucket TEXT,
  streaming_ready BOOLEAN,
  thumbnail_path TEXT,
  transcode_progress INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if the calling user is an admin
  SELECT (p.role = 'admin') INTO v_is_admin
  FROM profiles p
  WHERE p.id = auth.uid();
  
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Return all media assets with org and uploader details
  RETURN QUERY
  SELECT 
    ma.id,
    ma.org_id,
    o.name AS org_name,
    ma.uploader_id,
    p.name AS uploader_name,
    p.username AS uploader_username,
    ma.status::text AS status,
    ma.processing_stage::text AS processing_stage,
    ma.kind::text AS kind,
    ma.file_name,
    ma.file_size_bytes,
    ma.mime_type,
    ma.duration_seconds,
    ma.storage_path,
    ma.bucket,
    ma.streaming_ready,
    ma.thumbnail_path,
    ma.transcode_progress,
    ma.created_at
  FROM media_assets ma
  LEFT JOIN organizations o ON ma.org_id = o.id
  LEFT JOIN profiles p ON ma.uploader_id = p.id
  WHERE 
    -- Status filter
    (p_status IS NULL OR ma.status::text = p_status)
    -- Kind filter
    AND (p_kind IS NULL OR ma.kind::text = p_kind)
    -- Search filter (filename, org name, or uploader name/username)
    AND (
      p_search_query IS NULL 
      OR p_search_query = '' 
      OR ma.file_name ILIKE '%' || p_search_query || '%'
      OR o.name ILIKE '%' || p_search_query || '%'
      OR p.name ILIKE '%' || p_search_query || '%'
      OR p.username ILIKE '%' || p_search_query || '%'
    )
  ORDER BY ma.created_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_list_media_assets_rpc(TEXT, TEXT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_list_media_assets_rpc IS 'Admin function to list all media assets with search and filtering';

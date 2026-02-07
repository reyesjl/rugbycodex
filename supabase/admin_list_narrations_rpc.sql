-- =============================================
-- Admin List Narrations RPC
-- =============================================
-- Purpose: 
--   Returns all narrations with author and media asset details for admin moderation.
--   Includes search filtering and source type filtering.
--
-- Security:
--   - SECURITY DEFINER: Runs with owner privileges
--   - Explicit admin check: Only allows profiles with role = 'admin'
--
-- Parameters:
--   p_search_query TEXT - Optional search term for transcript or author
--   p_source_type TEXT - Optional filter: 'coach', 'staff', 'member', or NULL for all
--
-- Returns:
--   Table with narration details including author and media info
-- =============================================

CREATE OR REPLACE FUNCTION admin_list_narrations_rpc(
  p_search_query TEXT DEFAULT NULL,
  p_source_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  org_id UUID,
  org_name TEXT,
  media_asset_id UUID,
  media_asset_title TEXT,
  media_asset_segment_id UUID,
  author_id UUID,
  author_name TEXT,
  author_username TEXT,
  source_type TEXT,
  transcript_raw TEXT,
  transcript_clean TEXT,
  transcript_lang TEXT,
  audio_storage_path TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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

  -- Return all narrations with author and media details
  RETURN QUERY
  SELECT 
    n.id,
    n.org_id,
    o.name AS org_name,
    n.media_asset_id,
    ma.file_name AS media_asset_title,
    n.media_asset_segment_id,
    n.author_id,
    p.name AS author_name,
    p.username AS author_username,
    n.source_type::text AS source_type,
    n.transcript_raw,
    n.transcript_clean,
    n.transcript_lang,
    n.audio_storage_path,
    n.created_at,
    n.updated_at
  FROM narrations n
  LEFT JOIN profiles p ON n.author_id = p.id
  LEFT JOIN organizations o ON n.org_id = o.id
  LEFT JOIN media_assets ma ON n.media_asset_id = ma.id
  WHERE 
    -- Source type filter (cast text to enum type)
    (p_source_type IS NULL OR n.source_type::text = p_source_type)
    -- Search filter (transcript or author name/username)
    AND (
      p_search_query IS NULL 
      OR p_search_query = '' 
      OR n.transcript_raw ILIKE '%' || p_search_query || '%'
      OR p.name ILIKE '%' || p_search_query || '%'
      OR p.username ILIKE '%' || p_search_query || '%'
    )
  ORDER BY n.created_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_list_narrations_rpc(TEXT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_list_narrations_rpc IS 'Admin function to list all narrations with search and filtering';

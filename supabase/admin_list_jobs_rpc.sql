-- =============================================
-- Admin List Jobs RPC
-- =============================================
-- Purpose: 
--   Returns all jobs with org and creator details for admin monitoring.
--   Includes search filtering and state/type filtering.
--
-- Security:
--   - SECURITY DEFINER: Runs with owner privileges
--   - Explicit admin check: Only allows profiles with role = 'admin'
--
-- Parameters:
--   p_search_query TEXT - Optional search term for org name or creator
--   p_state TEXT - Optional filter by state
--   p_type TEXT - Optional filter by type
--
-- Returns:
--   Table with job details including org and creator info
-- =============================================

CREATE OR REPLACE FUNCTION admin_list_jobs_rpc(
  p_search_query TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  org_id UUID,
  org_name TEXT,
  media_asset_id UUID,
  media_asset_segment_id UUID,
  narration_id UUID,
  type TEXT,
  state TEXT,
  progress NUMERIC,
  error_code TEXT,
  error_message TEXT,
  attempt INTEGER,
  created_by UUID,
  creator_name TEXT,
  creator_username TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
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

  -- Return all jobs with org and creator details
  RETURN QUERY
  SELECT 
    j.id,
    j.org_id,
    o.name AS org_name,
    j.media_asset_id,
    j.media_asset_segment_id,
    j.narration_id,
    j.type::text AS type,
    j.state::text AS state,
    j.progress,
    j.error_code,
    j.error_message,
    j.attempt,
    j.created_by,
    p.name AS creator_name,
    p.username AS creator_username,
    j.created_at,
    j.updated_at,
    j.started_at,
    j.finished_at
  FROM jobs j
  LEFT JOIN organizations o ON j.org_id = o.id
  LEFT JOIN profiles p ON j.created_by = p.id
  WHERE 
    -- State filter
    (p_state IS NULL OR j.state::text = p_state)
    -- Type filter
    AND (p_type IS NULL OR j.type::text = p_type)
    -- Search filter (org name or creator name/username)
    AND (
      p_search_query IS NULL 
      OR p_search_query = '' 
      OR o.name ILIKE '%' || p_search_query || '%'
      OR p.name ILIKE '%' || p_search_query || '%'
      OR p.username ILIKE '%' || p_search_query || '%'
    )
  ORDER BY j.created_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_list_jobs_rpc(TEXT, TEXT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_list_jobs_rpc IS 'Admin function to list all jobs with search and filtering';

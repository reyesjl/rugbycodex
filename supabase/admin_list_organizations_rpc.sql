-- Admin RPC: List Organizations with Aggregated Stats
-- Returns all organizations with member counts, storage usage, and activity data
-- Used by: AdminOrgs.vue to display organization directory
-- Replaces: Edge Function "list-organizations-admin"

-- Drop function if exists (for iterative development)
DROP FUNCTION IF EXISTS admin_list_organizations(TEXT, TEXT, TEXT, INTEGER, INTEGER);

-- Create list organizations function
CREATE OR REPLACE FUNCTION admin_list_organizations(
  p_search TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_visibility TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  -- Organization fields
  id UUID,
  owner UUID,
  slug TEXT,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  storage_limit_mb INTEGER,
  bio TEXT,
  visibility TEXT,
  type TEXT,
  -- Aggregated fields
  member_count BIGINT,
  storage_used_bytes BIGINT,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  health_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check if current user is admin
  SELECT (p.role = 'admin') INTO v_is_admin
  FROM profiles p
  WHERE p.id = auth.uid();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Return organizations with aggregated stats
  RETURN QUERY
  SELECT 
    o.id,
    o.owner,
    o.slug,
    o.name,
    o.created_at,
    o.storage_limit_mb,
    o.bio,
    o.visibility::TEXT,
    o.type::TEXT,
    -- Count members
    COALESCE(member_stats.count, 0)::BIGINT AS member_count,
    -- Sum storage used
    COALESCE(storage_stats.total_bytes, 0)::BIGINT AS storage_used_bytes,
    -- Get most recent activity (most recent media asset created)
    storage_stats.last_activity AS last_activity_at,
    -- Calculate health status based on storage utilization
    CASE 
      WHEN COALESCE(storage_stats.total_bytes, 0) >= (o.storage_limit_mb::BIGINT * 1024 * 1024) THEN 'critical'
      WHEN COALESCE(storage_stats.total_bytes, 0) >= (o.storage_limit_mb::BIGINT * 1024 * 1024 * 0.8) THEN 'warning'
      ELSE 'healthy'
    END::TEXT AS health_status
  FROM organizations o
  -- Left join member counts
  LEFT JOIN (
    SELECT 
      org_id,
      COUNT(*) as count
    FROM org_members
    GROUP BY org_id
  ) member_stats ON member_stats.org_id = o.id
  -- Left join storage stats
  LEFT JOIN (
    SELECT 
      ma.org_id,
      SUM(ma.file_size_bytes) as total_bytes,
      MAX(ma.created_at) as last_activity
    FROM media_assets ma
    GROUP BY ma.org_id
  ) storage_stats ON storage_stats.org_id = o.id
  WHERE 
    -- Apply search filter (case-insensitive name or slug)
    (p_search IS NULL OR 
     o.name ILIKE '%' || p_search || '%' OR 
     o.slug ILIKE '%' || p_search || '%')
    -- Apply type filter
    AND (p_type IS NULL OR o.type::TEXT = p_type)
    -- Apply visibility filter
    AND (p_visibility IS NULL OR o.visibility::TEXT = p_visibility)
  ORDER BY o.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION admin_list_organizations(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION admin_list_organizations IS 
'Admin-only function to list all organizations with aggregated statistics including member counts, storage usage, and last activity. Supports filtering by search term, type, and visibility.';

-- Test queries

-- Get all organizations
-- SELECT * FROM admin_list_organizations(NULL, NULL, NULL, 100, 0);

-- Search for specific org
-- SELECT * FROM admin_list_organizations('rugby', NULL, NULL, 10, 0);

-- Filter by type
-- SELECT * FROM admin_list_organizations(NULL, 'team', NULL, 100, 0);

-- Filter by visibility
-- SELECT * FROM admin_list_organizations(NULL, NULL, 'public', 100, 0);

-- Combined filters with pagination
-- SELECT * FROM admin_list_organizations('test', 'team', 'public', 20, 0);

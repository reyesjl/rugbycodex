-- Admin RPC: List All Users
-- Allows platform admins to list all users with aggregated stats
-- Used by: AdminUsers.vue

-- Drop function if exists (for iterative development)
DROP FUNCTION IF EXISTS admin_list_users(TEXT, TEXT, BOOLEAN, INTEGER, INTEGER);

-- Create list users function
CREATE OR REPLACE FUNCTION admin_list_users(
  p_search TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_has_primary_org BOOLEAN DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  username TEXT,
  role TEXT,
  xp BIGINT,
  primary_org UUID,
  primary_org_name TEXT,
  creation_time TIMESTAMPTZ,
  org_membership_count BIGINT
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
  
  -- Return users with aggregated data
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.username,
    p.role::TEXT,
    p.xp,
    p.primary_org,
    o.name as primary_org_name,
    p.creation_time,
    COALESCE(COUNT(om.user_id), 0)::BIGINT as org_membership_count
  FROM profiles p
  LEFT JOIN organizations o ON p.primary_org = o.id
  LEFT JOIN org_members om ON p.id = om.user_id
  WHERE
    -- Search filter (name or username)
    (p_search IS NULL OR 
     p.name ILIKE '%' || p_search || '%' OR 
     p.username ILIKE '%' || p_search || '%')
    -- Role filter
    AND (p_role IS NULL OR p.role::TEXT = p_role)
    -- Primary org filter
    AND (p_has_primary_org IS NULL OR 
         (p_has_primary_org = TRUE AND p.primary_org IS NOT NULL) OR
         (p_has_primary_org = FALSE AND p.primary_org IS NULL))
  GROUP BY p.id, o.name
  ORDER BY p.creation_time DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION admin_list_users(TEXT, TEXT, BOOLEAN, INTEGER, INTEGER) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION admin_list_users IS 
'Admin-only function to list all users with aggregated statistics including org memberships.';

-- Test query (replace with real values to test)
-- SELECT * FROM admin_list_users(NULL, NULL, NULL, 20, 0);

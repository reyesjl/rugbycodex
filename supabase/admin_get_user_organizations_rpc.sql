-- Admin RPC: Get User Organizations
-- Allows platform admins to get all organization memberships for a user
-- Used by: AdminUsers.vue user organizations modal

-- Drop function if exists (for iterative development)
DROP FUNCTION IF EXISTS admin_get_user_organizations(UUID);

-- Create get user organizations function
CREATE OR REPLACE FUNCTION admin_get_user_organizations(
  p_user_id UUID
)
RETURNS TABLE(
  org_id UUID,
  org_name TEXT,
  org_slug TEXT,
  org_type TEXT,
  member_role TEXT,
  joined_at TIMESTAMPTZ
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
  
  -- Return user's organization memberships
  RETURN QUERY
  SELECT 
    o.id as org_id,
    o.name as org_name,
    o.slug as org_slug,
    o.type::TEXT as org_type,
    om.role::TEXT as member_role,
    om.joined_at as joined_at
  FROM org_members om
  INNER JOIN organizations o ON om.org_id = o.id
  WHERE om.user_id = p_user_id
  ORDER BY om.joined_at DESC;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION admin_get_user_organizations(UUID) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION admin_get_user_organizations IS 
'Admin-only function to retrieve all organization memberships for a specific user.';

-- Test query (replace with real values to test)
-- SELECT * FROM admin_get_user_organizations('user-id-here');

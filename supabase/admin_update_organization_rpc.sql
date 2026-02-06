-- Admin RPC: Update Organization
-- Allows platform admins to update organization details
-- Used by: AdminOrgs.vue edit modal

-- Drop function if exists (for iterative development)
DROP FUNCTION IF EXISTS admin_update_organization(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER);

-- Create update organization function
CREATE OR REPLACE FUNCTION admin_update_organization(
  p_org_id UUID,
  p_name TEXT,
  p_bio TEXT,
  p_type TEXT,
  p_visibility TEXT,
  p_storage_limit_mb INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_is_admin boolean;
BEGIN
  -- Check if current user is admin
  SELECT (role = 'admin') INTO v_is_admin
  FROM profiles
  WHERE id = auth.uid();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Validate input
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) = 0 THEN
    RAISE EXCEPTION 'Organization name cannot be empty';
  END IF;
  
  IF p_type NOT IN ('team', 'personal') THEN
    RAISE EXCEPTION 'Invalid organization type. Must be "team" or "personal"';
  END IF;
  
  IF p_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'Invalid visibility. Must be "public" or "private"';
  END IF;
  
  IF p_storage_limit_mb < 0 THEN
    RAISE EXCEPTION 'Storage limit must be positive';
  END IF;
  
  -- Update organization
  UPDATE organizations
  SET 
    name = p_name,
    bio = NULLIF(TRIM(p_bio), ''),
    type = p_type::organization_type,
    visibility = p_visibility::organization_visibility,
    storage_limit_mb = p_storage_limit_mb
  WHERE id = p_org_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;
  
  -- Return success with updated org data
  SELECT jsonb_build_object(
    'success', true,
    'organization', row_to_json(o.*)
  )
  INTO v_result
  FROM organizations o
  WHERE o.id = p_org_id;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION admin_update_organization(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION admin_update_organization IS 
'Admin-only function to update organization details including name, bio, type, visibility, and storage limit.';

-- Test query (replace with real values to test)
-- SELECT admin_update_organization(
--   'org-id-here',
--   'Updated Org Name',
--   'Updated bio',
--   'team',
--   'public',
--   51200
-- );

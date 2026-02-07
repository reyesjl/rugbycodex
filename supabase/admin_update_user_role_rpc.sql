-- Admin RPC: Update User Role
-- Allows platform admins to change a user's role (user <-> admin)
-- Used by: AdminUsers.vue edit role modal

-- Drop function if exists (for iterative development)
DROP FUNCTION IF EXISTS admin_update_user_role(UUID, TEXT);

-- Create update user role function
CREATE OR REPLACE FUNCTION admin_update_user_role(
  p_user_id UUID,
  p_new_role TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_is_admin boolean;
  v_current_user_id uuid;
BEGIN
  -- Get current user ID
  v_current_user_id := auth.uid();
  
  -- Check if current user is admin
  SELECT (role = 'admin') INTO v_is_admin
  FROM profiles
  WHERE id = v_current_user_id;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Prevent self-demotion (admin safety)
  IF v_current_user_id = p_user_id AND p_new_role != 'admin' THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;
  
  -- Validate role value
  IF p_new_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Invalid role. Must be "user" or "admin"';
  END IF;
  
  -- Update user role
  UPDATE profiles
  SET role = p_new_role::profile_role
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Return success with updated user data
  SELECT jsonb_build_object(
    'success', true,
    'user', row_to_json(p.*)
  )
  INTO v_result
  FROM profiles p
  WHERE p.id = p_user_id;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION admin_update_user_role(UUID, TEXT) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION admin_update_user_role IS 
'Admin-only function to update a user role. Prevents self-demotion for safety.';

-- Test query (replace with real values to test)
-- SELECT admin_update_user_role('user-id-here', 'admin');

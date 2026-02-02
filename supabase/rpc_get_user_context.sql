-- =====================================================
-- User Context RPC Function
-- =====================================================
-- Purpose: Fetch user profile + organization memberships + org details in a single query
-- Returns: JSON object with user profile and all organization contexts
-- Security: SECURITY DEFINER to allow reading own data under RLS

CREATE OR REPLACE FUNCTION get_user_context()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT json_build_object(
    'profile', (
      SELECT row_to_json(p.*)
      FROM profiles p
      WHERE p.id = auth.uid()
    ),
    'organizations', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'membership', json_build_object(
            'org_id', om.org_id,
            'user_id', om.user_id,
            'role', om.role,
            'joined_at', om.joined_at
          ),
          'organization', json_build_object(
            'id', o.id,
            'slug', o.slug,
            'name', o.name,
            'bio', o.bio,
            'type', o.type,
            'visibility', o.visibility,
            'created_at', o.created_at,
            'storage_limit_mb', o.storage_limit_mb,
            'owner', o.owner
          ),
          'member_count', (
            SELECT COUNT(*)::int
            FROM org_members om_count
            WHERE om_count.org_id = o.id
          )
        )
        ORDER BY om.joined_at DESC
      ), '[]'::json)
      FROM org_members om
      INNER JOIN organizations o ON o.id = om.org_id
      WHERE om.user_id = auth.uid()
    ),
    'primary_org', (
      SELECT row_to_json(o.*)
      FROM organizations o
      WHERE o.id = (
        SELECT primary_org
        FROM profiles
        WHERE id = auth.uid()
      )
    )
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_context() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_user_context() IS 
'Fetches the current authenticated user profile, all organization memberships with org details, and primary organization in a single optimized query. Used for app initialization.';

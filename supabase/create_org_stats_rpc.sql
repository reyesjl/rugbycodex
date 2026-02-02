-- Week 3: Stats RPC Function
-- Replaces N+1 query pattern in useOrgStats.ts
-- Reduces 104+ queries to 1 query

-- Drop function if exists (for iterative development)
DROP FUNCTION IF EXISTS get_org_stats(UUID);

-- Create aggregated org stats function
CREATE OR REPLACE FUNCTION get_org_stats(p_org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_cutoff_date timestamp;
  v_total_matches integer;
  v_matches_last_30_days integer;
  v_total_narrations integer;
  v_total_segments integer;
  v_identity_tagged_segments integer;
  v_well_covered_matches integer;
  v_avg_narrations_per_match integer;
  v_incomplete_assignments integer;
BEGIN
  -- Calculate cutoff for "last 30 days"
  v_cutoff_date := NOW() - INTERVAL '30 days';
  
  -- Count total matches (all media assets, not filtered by kind)
  SELECT COUNT(*)
  INTO v_total_matches
  FROM media_assets
  WHERE org_id = p_org_id;
  
  -- Count matches in last 30 days (all media assets)
  SELECT COUNT(*)
  INTO v_matches_last_30_days
  FROM media_assets
  WHERE org_id = p_org_id
    AND created_at >= v_cutoff_date;
  
  -- Count total narrations (for all media assets)
  SELECT COUNT(n.id)
  INTO v_total_narrations
  FROM narrations n
  INNER JOIN media_assets ma ON ma.id = n.media_asset_id
  WHERE ma.org_id = p_org_id;
  
  -- Count total segments (for all media assets)
  SELECT COUNT(s.id)
  INTO v_total_segments
  FROM media_asset_segments s
  INNER JOIN media_assets ma ON ma.id = s.media_asset_id
  WHERE ma.org_id = p_org_id;
  
  -- Count segments with identity tags (for all media assets)
  SELECT COUNT(DISTINCT st.segment_id)
  INTO v_identity_tagged_segments
  FROM segment_tags st
  INNER JOIN media_asset_segments s ON s.id = st.segment_id
  INNER JOIN media_assets ma ON ma.id = s.media_asset_id
  WHERE ma.org_id = p_org_id
    AND st.tag_type = 'identity';
  
  -- Count well-covered matches (>= 35 narrations, all media assets)
  SELECT COUNT(*)
  INTO v_well_covered_matches
  FROM (
    SELECT ma.id, COUNT(n.id) as narration_count
    FROM media_assets ma
    LEFT JOIN narrations n ON n.media_asset_id = ma.id
    WHERE ma.org_id = p_org_id
    GROUP BY ma.id
    HAVING COUNT(n.id) >= 35
  ) subquery;
  
  -- Calculate average narrations per match
  v_avg_narrations_per_match := CASE 
    WHEN v_total_matches > 0 THEN ROUND(v_total_narrations::numeric / v_total_matches)
    ELSE 0
  END;
  
  -- Count incomplete assignments (org-wide)
  -- With progress rows pre-created, an assignment is incomplete if ANY recipient has completed=false
  -- Note: Progress rows are created via initialize_assignment_progress() when assignment is created
  SELECT COUNT(DISTINCT ap.assignment_id)
  INTO v_incomplete_assignments
  FROM assignment_progress ap
  INNER JOIN assignments a ON a.id = ap.assignment_id
  WHERE a.org_id = p_org_id
    AND ap.completed = false;
  
  -- Build result JSON
  v_result := jsonb_build_object(
    'total_matches', v_total_matches,
    'matches_last_30_days', v_matches_last_30_days,
    'total_narrations', v_total_narrations,
    'total_segments', v_total_segments,
    'identity_tagged_segments', v_identity_tagged_segments,
    'well_covered_matches', v_well_covered_matches,
    'avg_narrations_per_match', v_avg_narrations_per_match,
    'incomplete_assignments', v_incomplete_assignments
  );
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_org_stats(UUID) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_org_stats IS 
'Returns aggregated statistics for an organization. Replaces N+1 query pattern in dashboard.';

-- Test query (replace with real org_id to test)
-- SELECT get_org_stats('your-org-id-here');

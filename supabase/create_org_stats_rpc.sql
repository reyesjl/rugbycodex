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
BEGIN
  -- Calculate cutoff for "last 30 days"
  v_cutoff_date := NOW() - INTERVAL '30 days';
  
  -- Single query with all aggregations
  SELECT jsonb_build_object(
    -- Total matches
    'total_matches', COUNT(DISTINCT ma.id),
    
    -- Matches in last 30 days
    'matches_last_30_days', COUNT(DISTINCT ma.id) FILTER (
      WHERE ma.created_at >= v_cutoff_date
    ),
    
    -- Total narrations across all matches
    'total_narrations', COUNT(DISTINCT n.id),
    
    -- Total segments across all matches
    'total_segments', COUNT(DISTINCT s.id),
    
    -- Segments with identity tags (unique segments only)
    'identity_tagged_segments', COUNT(DISTINCT st.segment_id) FILTER (
      WHERE st.tag_type = 'identity'
    ),
    
    -- Well-covered matches (>= 35 narrations per match)
    'well_covered_matches', COUNT(DISTINCT ma.id) FILTER (
      WHERE (
        SELECT COUNT(*) 
        FROM narrations 
        WHERE media_asset_id = ma.id
      ) >= 35
    ),
    
    -- Average narrations per match (rounded)
    'avg_narrations_per_match', COALESCE(
      ROUND(
        COUNT(DISTINCT n.id)::numeric / NULLIF(COUNT(DISTINCT ma.id), 0)
      ),
      0
    )
  )
  INTO v_result
  FROM media_assets ma
  LEFT JOIN narrations n ON n.media_asset_id = ma.id
  LEFT JOIN segments s ON s.media_asset_id = ma.id
  LEFT JOIN segment_tags st ON st.segment_id = s.id
  WHERE ma.org_id = p_org_id
    AND ma.kind = 'match'; -- Only count matches, not other media types
  
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

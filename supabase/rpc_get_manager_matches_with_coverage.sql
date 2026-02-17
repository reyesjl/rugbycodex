-- =====================================================
-- Manager Matches With Coverage RPC Function
-- =====================================================
-- Purpose: Efficiently fetch matches for org managers with coverage analysis
-- Returns: Match details with narration counts and gap analysis for coverage tier calculation
-- Performance: Replaces 2 queries per match + base queries with single query per org
-- Security: SECURITY DEFINER to allow managers to see match data

DROP FUNCTION IF EXISTS rpc_get_manager_matches_with_coverage(uuid, int, text[]);

CREATE OR REPLACE FUNCTION rpc_get_manager_matches_with_coverage(
  p_org_id uuid,
  p_limit int DEFAULT 5,
  p_exclude_kinds text[] DEFAULT NULL
)
RETURNS TABLE (
  media_asset_id uuid,
  org_id uuid,
  file_name text,
  kind text,
  duration_seconds numeric,
  created_at timestamptz,
  thumbnail_path text,
  thumbnail_sprite_path text,
  thumbnail_vtt_path text,
  narration_count int,
  max_gap_minutes numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH media_assets_limited AS (
    -- Get most recent media assets for the org (only ready/complete videos)
    SELECT 
      ma.id,
      ma.org_id,
      ma.file_name,
      ma.kind,
      ma.duration_seconds,
      ma.created_at,
      ma.thumbnail_path,
      ma.thumbnail_sprite_path,
      ma.thumbnail_vtt_path
    FROM media_assets ma
    WHERE ma.org_id = p_org_id
      AND (p_exclude_kinds IS NULL OR ma.kind <> ALL(p_exclude_kinds::media_asset_kind[]))
      AND ma.streaming_ready = true
      AND ma.processing_stage = 'complete'
    ORDER BY ma.created_at DESC
    LIMIT p_limit
  ),
  
  narration_counts AS (
    -- Count narrations per media asset
    SELECT 
      n.media_asset_id,
      COUNT(*)::int as narration_count
    FROM narrations n
    WHERE n.media_asset_id IN (SELECT id FROM media_assets_limited)
    GROUP BY n.media_asset_id
  ),
  
  narrated_segments AS (
    -- Get all segments that have narrations for our media assets
    SELECT DISTINCT
      mas.id as segment_id,
      mas.media_asset_id,
      mas.start_seconds,
      mas.end_seconds
    FROM media_asset_segments mas
    INNER JOIN narrations n ON n.media_asset_segment_id = mas.id
    WHERE mas.media_asset_id IN (SELECT id FROM media_assets_limited)
  ),
  
  segment_gaps AS (
    -- Calculate gaps between consecutive segments for each media asset
    SELECT 
      ns1.media_asset_id,
      ns1.segment_id as segment_1_id,
      ns2.segment_id as segment_2_id,
      (ns2.start_seconds - ns1.end_seconds) as gap_seconds
    FROM narrated_segments ns1
    INNER JOIN narrated_segments ns2 
      ON ns1.media_asset_id = ns2.media_asset_id
      AND ns2.start_seconds > ns1.end_seconds
    WHERE NOT EXISTS (
      -- Ensure ns2 is the immediate next segment (no segment between ns1 and ns2)
      SELECT 1 
      FROM narrated_segments ns_between
      WHERE ns_between.media_asset_id = ns1.media_asset_id
        AND ns_between.start_seconds > ns1.end_seconds
        AND ns_between.start_seconds < ns2.start_seconds
    )
  ),
  
  max_gaps AS (
    -- Get maximum gap for each media asset
    SELECT 
      sg.media_asset_id,
      MAX(sg.gap_seconds) / 60.0 as max_gap_minutes
    FROM segment_gaps sg
    GROUP BY sg.media_asset_id
  )
  
  -- Final result: combine all data
  SELECT 
    mal.id as media_asset_id,
    mal.org_id,
    mal.file_name,
    mal.kind,
    mal.duration_seconds,
    mal.created_at,
    mal.thumbnail_path,
    mal.thumbnail_sprite_path,
    mal.thumbnail_vtt_path,
    COALESCE(nc.narration_count, 0) as narration_count,
    mg.max_gap_minutes
  FROM media_assets_limited mal
  LEFT JOIN narration_counts nc ON nc.media_asset_id = mal.id
  LEFT JOIN max_gaps mg ON mg.media_asset_id = mal.id
  ORDER BY mal.created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION rpc_get_manager_matches_with_coverage(uuid, int, text[]) TO authenticated;

COMMENT ON FUNCTION rpc_get_manager_matches_with_coverage(uuid, int, text[]) IS 
  'Efficiently fetches matches for org managers with narration coverage analysis. 
  Calculates narration counts and maximum gap between consecutive narrated segments.
  Supports excluding kinds via p_exclude_kinds.
  Returns one row per match ordered by created_at descending.';

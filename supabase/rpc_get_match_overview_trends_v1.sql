-- =====================================================
-- Match Overview Trends RPC (v1)
-- =====================================================
-- Purpose: Returns trend metrics comparing the match to recent matches.

DROP FUNCTION IF EXISTS rpc_get_match_overview_trends_v1(uuid, uuid, int);

CREATE OR REPLACE FUNCTION rpc_get_match_overview_trends_v1(
  p_org_id uuid,
  p_media_asset_id uuid,
  p_trend_window int DEFAULT 3
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH org_guard AS (
    SELECT 1
    FROM org_members
    WHERE org_id = p_org_id
      AND user_id = auth.uid()
  ),
  match_asset AS (
    SELECT ma.id
    FROM media_assets ma
    WHERE ma.id = p_media_asset_id
      AND ma.org_id = p_org_id
      AND EXISTS (SELECT 1 FROM org_guard)
  ),
  match_segments AS (
    SELECT mas.id
    FROM media_asset_segments mas
    JOIN match_asset ma ON ma.id = mas.media_asset_id
  ),
  match_narrations AS (
    SELECT n.id,
      n.media_asset_segment_id
    FROM narrations n
    JOIN match_asset ma ON ma.id = n.media_asset_id
  ),
  tag_base AS (
    SELECT st.segment_id,
      st.tag_type,
      replace(replace(lower(st.tag_key), ' ', '_'), '-', '_') AS normalized_key
    FROM segment_tags st
    JOIN match_segments ms ON ms.id = st.segment_id
  ),
  trend_matches AS (
    SELECT ma.id
    FROM media_assets ma
    WHERE ma.org_id = p_org_id
      AND ma.id <> p_media_asset_id
      AND ma.kind <> 'opposition'
    ORDER BY ma.created_at DESC
    LIMIT GREATEST(p_trend_window, 0)
  ),
  baseline_segments AS (
    SELECT mas.media_asset_id,
      mas.id AS segment_id
    FROM media_asset_segments mas
    JOIN trend_matches tm ON tm.id = mas.media_asset_id
  ),
  baseline_narrations AS (
    SELECT n.media_asset_id,
      COUNT(*)::int AS narration_count
    FROM narrations n
    WHERE n.media_asset_id IN (SELECT id FROM trend_matches)
    GROUP BY n.media_asset_id
  ),
  baseline_tag_base AS (
    SELECT bs.media_asset_id,
      st.segment_id,
      st.tag_type,
      replace(replace(lower(st.tag_key), ' ', '_'), '-', '_') AS normalized_key
    FROM baseline_segments bs
    JOIN segment_tags st ON st.segment_id = bs.segment_id
  ),
  baseline_tag_counts AS (
    SELECT media_asset_id,
      COUNT(DISTINCT segment_id) FILTER (WHERE tag_type = 'action')::int AS action_segments,
      COUNT(DISTINCT segment_id) FILTER (WHERE tag_type = 'identity')::int AS identity_segments,
      COUNT(DISTINCT segment_id) FILTER (
        WHERE tag_type = 'context'
          AND normalized_key IN ('scrum', 'lineout', 'kickoff', 'restart')
      )::int AS set_piece_segments,
      COUNT(DISTINCT segment_id) FILTER (
        WHERE tag_type = 'context'
          AND normalized_key IN ('exit', 'counter_attack', 'transition', 'broken_play')
      )::int AS transition_segments
    FROM baseline_tag_base
    GROUP BY media_asset_id
  ),
  baseline_agg AS (
    SELECT
      AVG(COALESCE(bn.narration_count, 0))::numeric AS narration_count_avg,
      AVG(COALESCE(bt.action_segments, 0))::numeric AS action_segments_avg,
      AVG(COALESCE(bt.identity_segments, 0))::numeric AS identity_segments_avg,
      AVG(COALESCE(bt.set_piece_segments, 0))::numeric AS set_piece_segments_avg,
      AVG(COALESCE(bt.transition_segments, 0))::numeric AS transition_segments_avg,
      COUNT(tm.id)::int AS sample_size
    FROM trend_matches tm
    LEFT JOIN baseline_narrations bn ON bn.media_asset_id = tm.id
    LEFT JOIN baseline_tag_counts bt ON bt.media_asset_id = tm.id
  ),
  current_metrics AS (
    SELECT
      (SELECT COUNT(*) FROM match_narrations)::numeric AS narration_count,
      (SELECT COUNT(DISTINCT segment_id) FROM tag_base WHERE tag_type = 'action')::numeric AS action_segments,
      (SELECT COUNT(DISTINCT segment_id) FROM tag_base WHERE tag_type = 'identity')::numeric AS identity_segments,
      (SELECT COUNT(DISTINCT segment_id) FROM tag_base
        WHERE tag_type = 'context'
          AND normalized_key IN ('scrum', 'lineout', 'kickoff', 'restart')
      )::numeric AS set_piece_segments,
      (SELECT COUNT(DISTINCT segment_id) FROM tag_base
        WHERE tag_type = 'context'
          AND normalized_key IN ('exit', 'counter_attack', 'transition', 'broken_play')
      )::numeric AS transition_segments
  )
  SELECT CASE
    WHEN ba.sample_size = 0 THEN '[]'::jsonb
    ELSE metrics.payload
  END
  FROM baseline_agg ba
  CROSS JOIN LATERAL (
    SELECT jsonb_agg(metric) AS payload
    FROM (
      SELECT jsonb_build_object(
        'metric_key', 'narration_count',
        'current_value', cm.narration_count,
        'baseline_value', ba.narration_count_avg,
        'delta_value', cm.narration_count - ba.narration_count_avg,
        'direction', CASE
          WHEN cm.narration_count - ba.narration_count_avg > 0 THEN 'up'
          WHEN cm.narration_count - ba.narration_count_avg < 0 THEN 'down'
          ELSE 'flat'
        END,
        'trend_window', p_trend_window,
        'sample_size', ba.sample_size
      ) AS metric
      FROM current_metrics cm
      UNION ALL
      SELECT jsonb_build_object(
        'metric_key', 'action_segments',
        'current_value', cm.action_segments,
        'baseline_value', ba.action_segments_avg,
        'delta_value', cm.action_segments - ba.action_segments_avg,
        'direction', CASE
          WHEN cm.action_segments - ba.action_segments_avg > 0 THEN 'up'
          WHEN cm.action_segments - ba.action_segments_avg < 0 THEN 'down'
          ELSE 'flat'
        END,
        'trend_window', p_trend_window,
        'sample_size', ba.sample_size
      )
      FROM current_metrics cm
      UNION ALL
      SELECT jsonb_build_object(
        'metric_key', 'set_piece_segments',
        'current_value', cm.set_piece_segments,
        'baseline_value', ba.set_piece_segments_avg,
        'delta_value', cm.set_piece_segments - ba.set_piece_segments_avg,
        'direction', CASE
          WHEN cm.set_piece_segments - ba.set_piece_segments_avg > 0 THEN 'up'
          WHEN cm.set_piece_segments - ba.set_piece_segments_avg < 0 THEN 'down'
          ELSE 'flat'
        END,
        'trend_window', p_trend_window,
        'sample_size', ba.sample_size
      )
      FROM current_metrics cm
      UNION ALL
      SELECT jsonb_build_object(
        'metric_key', 'transition_segments',
        'current_value', cm.transition_segments,
        'baseline_value', ba.transition_segments_avg,
        'delta_value', cm.transition_segments - ba.transition_segments_avg,
        'direction', CASE
          WHEN cm.transition_segments - ba.transition_segments_avg > 0 THEN 'up'
          WHEN cm.transition_segments - ba.transition_segments_avg < 0 THEN 'down'
          ELSE 'flat'
        END,
        'trend_window', p_trend_window,
        'sample_size', ba.sample_size
      )
      FROM current_metrics cm
      UNION ALL
      SELECT jsonb_build_object(
        'metric_key', 'identity_segments',
        'current_value', cm.identity_segments,
        'baseline_value', ba.identity_segments_avg,
        'delta_value', cm.identity_segments - ba.identity_segments_avg,
        'direction', CASE
          WHEN cm.identity_segments - ba.identity_segments_avg > 0 THEN 'up'
          WHEN cm.identity_segments - ba.identity_segments_avg < 0 THEN 'down'
          ELSE 'flat'
        END,
        'trend_window', p_trend_window,
        'sample_size', ba.sample_size
      )
      FROM current_metrics cm
    ) metrics
  ) metrics
  CROSS JOIN match_asset ma;
$$;

GRANT EXECUTE ON FUNCTION rpc_get_match_overview_trends_v1(uuid, uuid, int) TO authenticated;

COMMENT ON FUNCTION rpc_get_match_overview_trends_v1(uuid, uuid, int) IS
  'Returns trend metrics for a match compared to recent matches (default last 3).';

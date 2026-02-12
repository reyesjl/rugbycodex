-- =====================================================
-- Match Overview RPC (v1)
-- =====================================================
-- Purpose: Aggregated match overview payload for post-review insights.
-- Returns: JSONB payload containing story, tactical patterns, player impact, trends, and intelligence feed.

DROP FUNCTION IF EXISTS rpc_get_match_overview_v1(uuid, uuid, int, int);

CREATE OR REPLACE FUNCTION rpc_get_match_overview_v1(
  p_org_id uuid,
  p_media_asset_id uuid,
  p_trend_window int DEFAULT 3,
  p_feed_limit int DEFAULT 20
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
    SELECT ma.id,
      ma.org_id,
      ma.file_name,
      ma.created_at,
      ma.duration_seconds,
      ma.kind,
      ma.thumbnail_path
    FROM media_assets ma
    WHERE ma.id = p_media_asset_id
      AND ma.org_id = p_org_id
      AND EXISTS (SELECT 1 FROM org_guard)
  ),
  match_segments AS (
    SELECT mas.id,
      mas.segment_index,
      mas.start_seconds,
      mas.end_seconds
    FROM media_asset_segments mas
    JOIN match_asset ma ON ma.id = mas.media_asset_id
  ),
  segment_count AS (
    SELECT COUNT(*)::int AS segment_count
    FROM match_segments
  ),
  match_narrations AS (
    SELECT n.id,
      n.media_asset_segment_id
    FROM narrations n
    JOIN match_asset ma ON ma.id = n.media_asset_id
  ),
  narration_count AS (
    SELECT COUNT(*)::int AS narration_count
    FROM match_narrations
  ),
  tag_base AS (
    SELECT st.segment_id,
      st.tag_type,
      st.tag_key,
      replace(replace(lower(st.tag_key), ' ', '_'), '-', '_') AS normalized_key
    FROM segment_tags st
    JOIN match_segments ms ON ms.id = st.segment_id
  ),
  tag_counts AS (
    SELECT tag_type,
      normalized_key,
      COUNT(DISTINCT segment_id)::int AS segment_count
    FROM tag_base
    GROUP BY tag_type, normalized_key
  ),
  action_distribution AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'key', normalized_key,
          'label', initcap(replace(normalized_key, '_', ' ')),
          'segment_count', segment_count,
          'percent', percent
        )
        ORDER BY segment_count DESC
      ),
      '[]'::jsonb
    ) AS payload
    FROM (
      SELECT tc.normalized_key,
        tc.segment_count,
        CASE
          WHEN sc.segment_count = 0 THEN 0
          ELSE ROUND(tc.segment_count::numeric / sc.segment_count * 100, 2)
        END AS percent
      FROM tag_counts tc
      CROSS JOIN segment_count sc
      WHERE tc.tag_type = 'action'
      ORDER BY tc.segment_count DESC
      LIMIT 10
    ) rows
  ),
  set_piece_distribution AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'key', normalized_key,
          'label', initcap(replace(normalized_key, '_', ' ')),
          'segment_count', segment_count,
          'percent', percent
        )
        ORDER BY segment_count DESC
      ),
      '[]'::jsonb
    ) AS payload
    FROM (
      SELECT tc.normalized_key,
        tc.segment_count,
        CASE
          WHEN sc.segment_count = 0 THEN 0
          ELSE ROUND(tc.segment_count::numeric / sc.segment_count * 100, 2)
        END AS percent
      FROM tag_counts tc
      CROSS JOIN segment_count sc
      WHERE tc.tag_type = 'context'
        AND tc.normalized_key IN ('scrum', 'lineout', 'kickoff', 'restart')
      ORDER BY tc.segment_count DESC
    ) rows
  ),
  transition_distribution AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'key', normalized_key,
          'label', initcap(replace(normalized_key, '_', ' ')),
          'segment_count', segment_count,
          'percent', percent
        )
        ORDER BY segment_count DESC
      ),
      '[]'::jsonb
    ) AS payload
    FROM (
      SELECT tc.normalized_key,
        tc.segment_count,
        CASE
          WHEN sc.segment_count = 0 THEN 0
          ELSE ROUND(tc.segment_count::numeric / sc.segment_count * 100, 2)
        END AS percent
      FROM tag_counts tc
      CROSS JOIN segment_count sc
      WHERE tc.tag_type = 'context'
        AND tc.normalized_key IN ('exit', 'counter_attack', 'transition', 'broken_play')
      ORDER BY tc.segment_count DESC
    ) rows
  ),
  identity_tagged_segments AS (
    SELECT DISTINCT normalized_key,
      segment_id
    FROM tag_base
    WHERE tag_type = 'identity'
  ),
  identity_counts AS (
    SELECT normalized_key,
      COUNT(DISTINCT segment_id)::int AS segment_count
    FROM identity_tagged_segments
    GROUP BY normalized_key
  ),
  identity_narrations AS (
    SELECT its.normalized_key,
      COUNT(DISTINCT mn.id)::int AS narration_count
    FROM identity_tagged_segments its
    LEFT JOIN match_narrations mn ON mn.media_asset_segment_id = its.segment_id
    GROUP BY its.normalized_key
  ),
  player_actions AS (
    SELECT normalized_key,
      COALESCE(
        jsonb_agg(action_key ORDER BY action_count DESC),
        '[]'::jsonb
      ) AS top_actions
    FROM (
      SELECT its.normalized_key,
        tb.normalized_key AS action_key,
        COUNT(DISTINCT tb.segment_id) AS action_count,
        ROW_NUMBER() OVER (
          PARTITION BY its.normalized_key
          ORDER BY COUNT(DISTINCT tb.segment_id) DESC
        ) AS rn
      FROM identity_tagged_segments its
      JOIN tag_base tb
        ON tb.segment_id = its.segment_id
       AND tb.tag_type = 'action'
      GROUP BY its.normalized_key, tb.normalized_key
    ) ranked
    WHERE rn <= 3
    GROUP BY normalized_key
  ),
  player_impact AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'identity_tag_key', ic.normalized_key,
          'player_name', initcap(replace(ic.normalized_key, '_', ' ')),
          'segment_count', ic.segment_count,
          'narration_count', COALESCE(inr.narration_count, 0),
          'impact_score', ic.segment_count + COALESCE(inr.narration_count, 0),
          'top_actions', COALESCE(pa.top_actions, '[]'::jsonb)
        )
        ORDER BY (ic.segment_count + COALESCE(inr.narration_count, 0)) DESC
      ),
      '[]'::jsonb
    ) AS payload
    FROM identity_counts ic
    LEFT JOIN identity_narrations inr ON inr.normalized_key = ic.normalized_key
    LEFT JOIN player_actions pa ON pa.normalized_key = ic.normalized_key
  ),
  timeline_buckets AS (
    SELECT FLOOR(ms.start_seconds / 300)::int AS bucket_index,
      COUNT(DISTINCT ms.id)::int AS segment_count,
      COUNT(DISTINCT mn.id)::int AS narration_count
    FROM match_segments ms
    LEFT JOIN match_narrations mn ON mn.media_asset_segment_id = ms.id
    GROUP BY bucket_index
  ),
  momentum_timeline AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'bucket_start_seconds', bucket_index * 300,
          'bucket_end_seconds', (bucket_index + 1) * 300,
          'segment_count', segment_count,
          'narration_count', narration_count
        )
        ORDER BY bucket_index
      ),
      '[]'::jsonb
    ) AS payload
    FROM timeline_buckets
  ),
  theme_candidates AS (
    SELECT normalized_key,
      tag_type,
      segment_count
    FROM tag_counts
    WHERE tag_type IN ('action', 'context')
    ORDER BY segment_count DESC
    LIMIT 6
  ),
  themes_payload AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'theme_key', normalized_key,
          'label', initcap(replace(normalized_key, '_', ' ')),
          'confidence', NULL,
          'evidence', jsonb_build_object(
            'tag_keys', jsonb_build_array(normalized_key),
            'narration_count', nc.narration_count
          )
        )
        ORDER BY segment_count DESC
      ),
      '[]'::jsonb
    ) AS payload
    FROM theme_candidates tc
    CROSS JOIN narration_count nc
  ),
  match_summary AS (
    SELECT mi.*
    FROM match_intelligence mi
    JOIN match_asset ma ON ma.id = mi.media_asset_id
    WHERE mi.is_active = true
    ORDER BY mi.generated_at DESC
    LIMIT 1
  ),
  summary_payload AS (
    SELECT CASE
      WHEN ms.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'state', ms.state,
        'match_headline', ms.match_headline,
        'match_summary', to_jsonb(ms.match_summary),
        'sections', jsonb_build_object(
          'set_piece', ms.set_piece,
          'territory', ms.territory,
          'possession', ms.possession,
          'defence', ms.defence,
          'kick_battle', ms.kick_battle,
          'scoring', ms.scoring
        ),
        'narration_count_at_generation', ms.narration_count_at_generation,
        'generated_at', ms.generated_at
      )
    END AS payload
    FROM (SELECT 1) base
    LEFT JOIN match_summary ms ON true
  ),
  intelligence_feed AS (
    SELECT COALESCE(
      jsonb_agg(item ORDER BY generated_at DESC),
      '[]'::jsonb
    ) AS payload
    FROM (
      SELECT
        si.generated_at,
        jsonb_build_object(
          'segment_id', si.media_segment_id,
          'segment_index', ms.segment_index,
          'start_seconds', ms.start_seconds,
          'end_seconds', ms.end_seconds,
          'insight_headline', si.insight_headline,
          'insight_sentence', si.insight_sentence,
          'coach_script', si.coach_script,
          'narration_count_at_generation', si.narration_count_at_generation,
          'generated_at', si.generated_at,
          'tags', COALESCE(tb.tags, '[]'::jsonb)
        ) AS item
      FROM segment_insights si
      JOIN match_segments ms ON ms.id = si.media_segment_id
      LEFT JOIN (
        SELECT st.segment_id,
          jsonb_agg(
            jsonb_build_object(
              'tag_type', st.tag_type,
              'tag_key', st.tag_key
            )
            ORDER BY st.tag_type, st.tag_key
          ) AS tags
        FROM segment_tags st
        WHERE st.tag_type IN ('action', 'context')
        GROUP BY st.segment_id
      ) tb ON tb.segment_id = si.media_segment_id
      WHERE si.is_active = true
      ORDER BY si.generated_at DESC
      LIMIT p_feed_limit
    ) feed
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
  ),
  trends_payload AS (
    SELECT CASE
      WHEN ba.sample_size = 0 THEN '[]'::jsonb
      ELSE metrics.payload
    END AS payload
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
  )
  SELECT jsonb_build_object(
    'version', 'v1',
    'match_id', ma.id,
    'org_id', ma.org_id,
    'generated_at', now(),
    'match', jsonb_build_object(
      'id', ma.id,
      'file_name', ma.file_name,
      'created_at', ma.created_at,
      'duration_seconds', ma.duration_seconds,
      'kind', ma.kind,
      'thumbnail_path', ma.thumbnail_path
    ),
    'counts', jsonb_build_object(
      'narration_count', nc.narration_count,
      'segment_count', sc.segment_count
    ),
    'story', jsonb_build_object(
      'summary', sp.payload,
      'momentum_timeline', mt.payload,
      'themes', th.payload
    ),
    'tactical_patterns', jsonb_build_object(
      'set_pieces', spd.payload,
      'actions', ad.payload,
      'transitions', td.payload
    ),
    'player_impact', pi.payload,
    'trends', tr.payload,
    'intelligence_feed', inf.payload
  )
  FROM match_asset ma
  CROSS JOIN segment_count sc
  CROSS JOIN narration_count nc
  CROSS JOIN action_distribution ad
  CROSS JOIN set_piece_distribution spd
  CROSS JOIN transition_distribution td
  CROSS JOIN player_impact pi
  CROSS JOIN momentum_timeline mt
  CROSS JOIN themes_payload th
  CROSS JOIN summary_payload sp
  CROSS JOIN intelligence_feed inf
  CROSS JOIN trends_payload tr;
$$;

GRANT EXECUTE ON FUNCTION rpc_get_match_overview_v1(uuid, uuid, int, int) TO authenticated;

COMMENT ON FUNCTION rpc_get_match_overview_v1(uuid, uuid, int, int) IS
  'Returns aggregated match overview data (story, tactical patterns, player impact, trends, intelligence feed) for a match.';

-- =====================================================
-- Match Intelligence Feed RPC (v1)
-- =====================================================
-- Purpose: Returns segment-level intelligence feed for a match.

DROP FUNCTION IF EXISTS rpc_get_match_intelligence_feed_v1(uuid, uuid, int);

CREATE OR REPLACE FUNCTION rpc_get_match_intelligence_feed_v1(
  p_org_id uuid,
  p_media_asset_id uuid,
  p_limit int DEFAULT 20
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
    SELECT mas.id,
      mas.segment_index,
      mas.start_seconds,
      mas.end_seconds
    FROM media_asset_segments mas
    JOIN match_asset ma ON ma.id = mas.media_asset_id
  ),
  segment_tags_payload AS (
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
      AND st.segment_id IN (SELECT id FROM match_segments)
    GROUP BY st.segment_id
  )
  SELECT COALESCE(
    jsonb_agg(item ORDER BY generated_at DESC),
    '[]'::jsonb
  )
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
        'tags', COALESCE(stp.tags, '[]'::jsonb)
      ) AS item
    FROM segment_insights si
    JOIN match_segments ms ON ms.id = si.media_segment_id
    LEFT JOIN segment_tags_payload stp ON stp.segment_id = si.media_segment_id
    CROSS JOIN match_asset ma
    WHERE si.is_active = true
    ORDER BY si.generated_at DESC
    LIMIT p_limit
  ) feed;
$$;

GRANT EXECUTE ON FUNCTION rpc_get_match_intelligence_feed_v1(uuid, uuid, int) TO authenticated;

COMMENT ON FUNCTION rpc_get_match_intelligence_feed_v1(uuid, uuid, int) IS
  'Returns a segment-level intelligence feed (insights + tags) for a match.';

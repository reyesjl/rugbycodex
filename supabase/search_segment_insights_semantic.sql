-- =====================================================
-- Segment Insights Semantic Search (match-scoped)
-- =====================================================

DROP FUNCTION IF EXISTS public.search_segment_insights_semantic(uuid, uuid, vector, integer);

CREATE OR REPLACE FUNCTION public.search_segment_insights_semantic(
  org_id_filter uuid,
  media_asset_id_filter uuid,
  query_embedding vector,
  match_count integer DEFAULT 10
)
RETURNS TABLE(
  insight_id uuid,
  media_segment_id uuid,
  segment_index integer,
  start_seconds double precision,
  end_seconds double precision,
  insight_headline text,
  insight_sentence text,
  coach_script text,
  narration_count_at_generation integer,
  score double precision
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH org_guard AS (
    SELECT 1
    FROM org_members
    WHERE org_id = org_id_filter
      AND user_id = auth.uid()
  ),
  match_asset AS (
    SELECT ma.id
    FROM media_assets ma
    WHERE ma.id = media_asset_id_filter
      AND ma.org_id = org_id_filter
      AND EXISTS (SELECT 1 FROM org_guard)
  ),
  match_segments AS (
    SELECT mas.id,
      mas.segment_index,
      mas.start_seconds,
      mas.end_seconds
    FROM media_asset_segments mas
    JOIN match_asset ma ON ma.id = mas.media_asset_id
  )
  SELECT
    si.id AS insight_id,
    si.media_segment_id,
    ms.segment_index,
    ms.start_seconds,
    ms.end_seconds,
    si.insight_headline,
    si.insight_sentence,
    si.coach_script,
    si.narration_count_at_generation,
    1 - (si.embedding <=> query_embedding) AS score
  FROM segment_insights si
  JOIN match_segments ms ON ms.id = si.media_segment_id
  WHERE si.is_active = true
    AND si.embedding IS NOT NULL
    AND (1 - (si.embedding <=> query_embedding)) > 0.33
  ORDER BY si.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.search_segment_insights_semantic(uuid, uuid, vector, integer) TO authenticated;

COMMENT ON FUNCTION public.search_segment_insights_semantic(uuid, uuid, vector, integer) IS
  'Semantic search for segment insights scoped to a match.';

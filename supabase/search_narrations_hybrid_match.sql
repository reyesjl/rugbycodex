-- =====================================================
-- Narrations Hybrid Search (match-scoped)
-- =====================================================

DROP FUNCTION IF EXISTS public.search_narrations_hybrid_match(text, vector, integer, uuid, uuid);

CREATE OR REPLACE FUNCTION public.search_narrations_hybrid_match(
  query_text text,
  query_embedding vector,
  match_count integer,
  org_id_filter uuid,
  media_asset_id_filter uuid
)
RETURNS TABLE(
  narration_id uuid,
  media_asset_id uuid,
  media_asset_segment_id uuid,
  transcript text,
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
    SELECT ma.id, ma.org_id
    FROM media_assets ma
    WHERE ma.id = media_asset_id_filter
      AND ma.org_id = org_id_filter
      AND EXISTS (SELECT 1 FROM org_guard)
  ),
  semantic AS (
    SELECT
      n.id,
      n.media_asset_id,
      n.media_asset_segment_id,
      COALESCE(n.transcript_clean, n.transcript_raw) AS transcript,
      1 - (n.embedding <=> query_embedding) AS score
    FROM narrations n
    JOIN match_asset ma ON ma.id = n.media_asset_id
    WHERE n.embedding IS NOT NULL
      AND (1 - (n.embedding <=> query_embedding)) > 0.33
    ORDER BY n.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  lexical AS (
    SELECT
      n.id,
      n.media_asset_id,
      n.media_asset_segment_id,
      COALESCE(n.transcript_clean, n.transcript_raw) AS transcript,
      ts_rank(n.transcript_tsv, plainto_tsquery('simple', query_text)) AS score
    FROM narrations n
    JOIN match_asset ma ON ma.id = n.media_asset_id
    WHERE n.transcript_tsv @@ plainto_tsquery('simple', query_text)
    ORDER BY score DESC
    LIMIT match_count * 2
  ),
  combined AS (
    SELECT * FROM semantic
    UNION ALL
    SELECT * FROM lexical
  )
  SELECT
    id AS narration_id,
    media_asset_id,
    media_asset_segment_id,
    transcript,
    MAX(score) AS score
  FROM combined
  GROUP BY id, media_asset_id, media_asset_segment_id, transcript
  ORDER BY score DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.search_narrations_hybrid_match(text, vector, integer, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.search_narrations_hybrid_match(text, vector, integer, uuid, uuid) IS
  'Hybrid search for narrations scoped to a single media asset (semantic + lexical).';

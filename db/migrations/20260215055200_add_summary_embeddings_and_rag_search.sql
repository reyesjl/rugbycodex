-- Add summary embeddings + match-scoped RAG search functions

ALTER TABLE public.segment_insights
ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

DO $$
BEGIN
  ALTER TABLE public.segment_insights
    ADD CONSTRAINT segment_insights_embedding_dim_check
    CHECK (embedding IS NULL OR extensions.vector_dims(embedding) = 1536);
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS segment_insights_embedding_hnsw_idx
  ON public.segment_insights USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.match_intelligence
ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

DO $$
BEGIN
  ALTER TABLE public.match_intelligence
    ADD CONSTRAINT match_intelligence_embedding_dim_check
    CHECK (embedding IS NULL OR extensions.vector_dims(embedding) = 1536);
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS match_intelligence_embedding_hnsw_idx
  ON public.match_intelligence USING hnsw (embedding vector_cosine_ops);

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

DROP FUNCTION IF EXISTS public.search_match_intelligence_semantic(uuid, uuid, vector);
CREATE OR REPLACE FUNCTION public.search_match_intelligence_semantic(
  org_id_filter uuid,
  media_asset_id_filter uuid,
  query_embedding vector
)
RETURNS TABLE(
  intelligence_id uuid,
  match_headline text,
  match_summary text[],
  set_piece text,
  territory text,
  possession text,
  defence text,
  kick_battle text,
  scoring text,
  score double precision,
  generated_at timestamp with time zone
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
  )
  SELECT
    mi.id AS intelligence_id,
    mi.match_headline,
    mi.match_summary,
    mi.set_piece,
    mi.territory,
    mi.possession,
    mi.defence,
    mi.kick_battle,
    mi.scoring,
    1 - (mi.embedding <=> query_embedding) AS score,
    mi.generated_at
  FROM match_intelligence mi
  JOIN match_asset ma ON ma.id = mi.media_asset_id
  WHERE mi.is_active = true
    AND mi.embedding IS NOT NULL
    AND (1 - (mi.embedding <=> query_embedding)) > 0.33
  ORDER BY mi.embedding <=> query_embedding, mi.generated_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.search_match_intelligence_semantic(uuid, uuid, vector) TO authenticated;

COMMENT ON FUNCTION public.search_match_intelligence_semantic(uuid, uuid, vector) IS
  'Semantic search for match intelligence scoped to a match.';

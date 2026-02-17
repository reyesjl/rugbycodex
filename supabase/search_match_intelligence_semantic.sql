-- =====================================================
-- Match Intelligence Semantic Search (match-scoped)
-- =====================================================

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

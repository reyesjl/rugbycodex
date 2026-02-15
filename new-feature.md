## Objective
Add a sleek chat-style “Ask RugbyCodex” panel on the **Match Overview** page.
- Scope: **ONLY this match** (single `media_asset_id`)
- v1: **single-shot deterministic RAG** (no agents, no looping tool calls)
- Retrieval: use existing **hybrid narration search** + add **summary embeddings** for `segment_insights` and `match_intelligence`
- UX: open chat UI (free text enabled), plus clickable preset prompts under the box
- Output: evidence-grounded analysis + links back to relevant segments

---

## 0) Key Constraints / Decisions
- Embedding model: `text-embedding-3-small` (1536 dims) (same as narrations)
- Similarity metric: cosine (`vector_cosine_ops`)
- Vector index: **HNSW** (match narrations setup)
- Keep summary tables **embedding-only** (no tsvector needed in v1)
- Retrieval budget: keep context under ~6k tokens
- Hallucination guard: analysis must cite evidence items; if insufficient evidence, say so.

---

## 1) Database Changes (Migrations)

### 1.1 Add embedding column to `segment_insights`
```sql
ALTER TABLE public.segment_insights
ADD COLUMN IF NOT EXISTS embedding extensions.vector;

ALTER TABLE public.segment_insights
ADD CONSTRAINT segment_insights_embedding_dim_check
CHECK (embedding IS NULL OR extensions.vector_dims(embedding) = 1536);

CREATE INDEX IF NOT EXISTS segment_insights_embedding_hnsw_idx
ON public.segment_insights
USING hnsw (embedding extensions.vector_cosine_ops);
1.2 Add embedding column to match_intelligence
ALTER TABLE public.match_intelligence
ADD COLUMN IF NOT EXISTS embedding extensions.vector;

ALTER TABLE public.match_intelligence
ADD CONSTRAINT match_intelligence_embedding_dim_check
CHECK (embedding IS NULL OR extensions.vector_dims(embedding) = 1536);

CREATE INDEX IF NOT EXISTS match_intelligence_embedding_hnsw_idx
ON public.match_intelligence
USING hnsw (embedding extensions.vector_cosine_ops);
Notes:

Keep your existing btree filtered indexes as-is.

No tsvector on summaries in v1.

2) Define “What Text Gets Embedded” (Summary Embedding Content)
2.1 segment_insights embedding payload (string)
Create a helper to build the embedding input:

Use semantically dense text from:

insight_headline

insight_sentence

coach_script (optional; include if present and not huge)

Recommended format:

Headline: {insight_headline}

Summary: {insight_sentence}

Coach Script: {coach_script?}
2.2 match_intelligence embedding payload (string)
Use:

match_headline

match_summary (array → join with "\n")

optional sections: set_piece, territory, possession, defence, kick_battle, scoring (include if present)

Recommended format:

Match Headline: {match_headline}

Match Summary:
- {match_summary.join("\n- ")}

Set Piece: {set_piece?}
Territory: {territory?}
Possession: {possession?}
Defence: {defence?}
Kick Battle: {kick_battle?}
Scoring: {scoring?}
3) Backfill Strategy (Existing Rows)
3.1 Backfill approach
Implement a one-off Node script (run from Linode) OR a protected admin edge function.
Goal: fill embeddings where embedding IS NULL, in batches, idempotently.

Batch guidelines:

Batch size: 50 rows

Delay: 300–800ms between batches (avoid rate limits)

Parallelism: 1 (simple + safe)

3.2 Backfill SQL selection queries
Segment insights to backfill (active only):

SELECT id, insight_headline, insight_sentence, coach_script
FROM public.segment_insights
WHERE is_active = true
  AND embedding IS NULL
ORDER BY generated_at ASC
LIMIT $1;
Match intelligence to backfill (active only):

SELECT id, match_headline, match_summary, set_piece, territory, possession, defence, kick_battle, scoring
FROM public.match_intelligence
WHERE is_active = true
  AND embedding IS NULL
ORDER BY generated_at ASC
LIMIT $1;
3.3 Update statements
UPDATE public.segment_insights
SET embedding = $2
WHERE id = $1 AND embedding IS NULL;
UPDATE public.match_intelligence
SET embedding = $2
WHERE id = $1 AND embedding IS NULL;
3.4 Script requirements
Use Supabase service role key

Use OpenAI embeddings API (text-embedding-3-small)

Log progress and failures

Allow resume (idempotent by WHERE embedding IS NULL)

Optional: write a “backfill_run_id” to logs, not DB

4) Build New Supabase Edge Function: ask-match-rag
4.1 Endpoint contract
POST /functions/v1/ask-match-rag

Headers:

auth required

x-org-id required (same pattern as existing generate-query-embedding)

Body:

{
  "media_asset_id": "uuid",
  "query": "string",
  "k_narrations": 20,
  "k_segment_insights": 10
}
Defaults:

k_narrations = 20

k_segment_insights = 10

4.2 Retrieval steps (match-scoped only)
Validate user/org membership (same as your current edge functions).

Generate query embedding via OpenAI.

Retrieve evidence from this match:

A) Narrations (existing hybrid function)

Call supabase.rpc('search_narrations_hybrid', ...) but ensure match scoping:

Either: add media_asset_id_filter param to RPC

Or: keep RPC generic and post-filter by media_asset_id (less ideal)

Use your current hybrid ranking formula; keep semantic threshold (0.33) for UI,
but for RAG consider applying an additional similarity cutoff in the edge function
before sending to LLM (e.g., only include semantic hits >= 0.40 if available).

B) Segment insights (new semantic retrieval)

Query segment_insights via join to media_asset_segments to scope by match:

SELECT si.id, si.media_segment_id, si.insight_headline, si.insight_sentence,
       si.narration_count_at_generation,
       (1 - (si.embedding <=> $1)) AS score
FROM public.segment_insights si
JOIN public.media_asset_segments mas ON mas.id = si.media_segment_id
WHERE si.is_active = true
  AND mas.media_asset_id = $2
  AND si.embedding IS NOT NULL
  AND (1 - (si.embedding <=> $1)) > 0.33
ORDER BY si.embedding <=> $1
LIMIT $3;
C) Match intelligence (optional for v1)

Fetch latest active row for this match:

SELECT id, match_headline, match_summary, set_piece, territory, possession, defence, kick_battle, scoring
FROM public.match_intelligence
WHERE is_active = true
  AND media_asset_id = $1
ORDER BY generated_at DESC
LIMIT 1;
Build an evidence bundle (see 4.3).

Call OpenAI Chat Completions (or Responses API) with grounding prompt.

Return structured output + citations.

4.3 Evidence bundle format (send to LLM)
Build a compact, structured string:

MATCH CONTEXT:
- media_asset_id: ...
- (optional) match_intelligence:
  Headline: ...
  Summary bullets: ...

RETRIEVED SEGMENT INSIGHTS (top {k_segment_insights}):
1) [segment_id: ...] {headline}
   {sentence}
   narration_count_at_generation: {n}

RETRIEVED NARRATIONS (top {k_narrations}):
1) [narration_id: ...] [segment_id: ...]
   text: {transcript_clean || transcript_raw}
   score: {score}
...
Token control:

Truncate each narration text to N characters (e.g., 350–600 chars)

Cap total narrations to k_narrations

Cap total insights to k_segment_insights

4.4 Prompting (grounded, match-scoped)
System message:

You are RugbyCodex, a rugby performance analyst.

Use ONLY provided evidence.

If evidence insufficient, say so.

Cite evidence IDs when making claims.

User message:

Include query

Include evidence bundle

Return format: JSON ONLY:

{
  "answer": "string",
  "key_points": [
    {
      "point": "string",
      "evidence": ["narration:<id>", "insight:<id>"]
    }
  ],
  "recommended_clips": [
    {
      "media_segment_id": "uuid",
      "reason": "string",
      "evidence": ["narration:<id>", "insight:<id>"]
    }
  ]
}
5) UI: Match Overview Chat Panel (Sleek + Ready)
5.1 Component: MatchRagChat
Visible on match overview page (for now)

Shows:

title: “Ask RugbyCodex”

chat transcript (user messages + assistant replies)

input box enabled (open chat)

preset prompt chips under input (click inserts & sends)

subtle disclaimer: “Answers are grounded in coach notes for this match.”

5.2 Preset prompt chips (v1)
“What patterns defined our defence today?”

“What were our biggest breakdown issues?”

“Where did we lose territory and why?”

“Summarize our kicking battle decisions.”

“What should we focus on in training from this match?”

All chips call the same backend endpoint as free text.

5.3 Interaction flow
On send:

optimistic append user message

call ask-match-rag

append assistant message (render answer + key points)

if recommended_clips exists, render clickable list:

clicking scrolls/highlights the segment in current match UI

or navigates to segment playback

5.4 Error UX
If endpoint fails:

assistant message: “Couldn’t analyze right now. Try again.”

If retrieval returns < 5 evidence items:

assistant message: “Not enough coach notes yet to answer confidently.”

6) Retrieval Plumbing To Add / Modify
6.1 Ensure narrations hybrid search can be match-scoped
Option A (preferred): extend search_narrations_hybrid RPC:

add param media_asset_id_filter uuid default null

apply it to both semantic and lexical candidate queries

Option B: post-filter results by media_asset_id in edge function

less accurate since ranking was global

Implement Option A if feasible.

6.2 Add a new SQL function for insight retrieval (optional)
If you prefer RPC for the insight query, create:

search_segment_insights_semantic(media_asset_id, query_embedding, match_count)
Returning media_segment_id, headline, sentence, score

7) Deployment Order Checklist
Deploy DB migrations (add embedding columns + HNSW indexes)

Update existing segment/match summary generation functions to also write embeddings on creation/regeneration

Run backfill script until no NULL embeddings remain

Deploy new edge function ask-match-rag

Update frontend match overview to include MatchRagChat

Add preset prompt chips

Test with:

low narration matches (should gracefully fail)

high narration matches (should produce good evidence-grounded answers)

8) Acceptance Criteria
Chat panel loads on match overview page

Clicking a preset prompt yields an assistant response grounded in retrieved evidence

Responses include evidence IDs and recommended segments where applicable

Works for matches with adequate narrations; fails gracefully when sparse

Summary embeddings exist and are indexed with HNSW like narrations

Backfill completes without rate limit explosions and can resume safely
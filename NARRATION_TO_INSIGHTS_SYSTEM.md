# Rugbycodex End-to-End Narration -> Insights System (Current Implementation)

This document describes how the system currently works from coach narration capture on a `media_asset_segment`, through summary generation, to hybrid retrieval and RAG answering.

---

## 1) Narration ingestion: from coach recording to `narrations` row

### 1.1 Entry points where narrations are created
- Match review flow (dynamic segment attachment): `OrgMediaAssetReviewView.vue`
- Feed flow (fixed segment): `FeedItem.vue`
- Segment detail flow (fixed segment): `NarrationView.vue`

All flows converge to `narrationService.createNarration(...)` in:
- `frontend/src/modules/narrations/services/narrationService.ts`

### 1.2 Audio recording + transcript capture
- Client recording uses MediaRecorder (`useAudioRecording` / `useNarrationRecorder`).
- Recorded blob is sent to edge function `transcribe-webm-file`.
- `transcribe-webm-file`:
  - Requires authenticated user + org role (`member` or above).
  - Accepts WebM or MP4/AAC (`.webm`, `.m4a`, `.mp4`).
  - Calls OpenAI Whisper (`whisper-1`) and returns `{ text }`.

### 1.3 How narration attaches to a segment
- Fixed flows: narration always uses the current `media_asset_segment_id`.
- Match-review dynamic flow:
  - If user clicked “Add” on a specific segment: always attaches there.
  - If not, system finds best overlapping segment using:
    1. highest overlap seconds
    2. most narrations
    3. source priority (`coach > staff/owner/manager > member > auto > ai`)
  - Minimum overlap threshold:
    - `max(2s, min(0.5 * recordingDuration, 0.5 * segmentDuration))`
  - If overlap is below threshold: create a new segment with buffer logic.
  - If attached and recording exceeds current segment end: segment may extend (up to 6s, clamped).

### 1.4 Database write for narration
`narrationService.createNarration(...)` inserts into `narrations`:
- `org_id`
- `media_asset_id`
- `media_asset_segment_id`
- `author_id`
- `source_type` (snapshotted from `org_members.role` mapping)
- `transcript_raw`

RLS enforces organization access and mutation rules.

### 1.5 Auto-tagging after narration (`auto-tag-segment`)
- In match review, after narration save succeeds, UI calls `runAutoTagging(...)` when `canAutoTagSegments` is true.
- Service path:
  - `segmentAutoTagService.autoTagSegment(...)`
  - Edge function `auto-tag-segment`
- Access control:
  - authenticated user
  - org-scoped role check
  - requires **staff+** (with admin bypass support in the function)
- Input options:
  - `narration_id` and/or `segment_id`
  - optional `force=true` to clear existing suggestions first
- Function behavior:
  1. Resolve segment from narration (if needed).
  2. Load segment context + media asset + narrations for the segment.
  3. Load existing `segment_tags` and org member identities (`org_members` + profiles).
  4. Call OpenAI tagging prompt (`gpt-4.1-mini` default) constrained to allowed vocab:
     - action tags: `carry, pass, kick, tackle, breakdown, maul`
     - context tags: set piece + transition tags (`scrum, lineout, kickoff, restart, exit, counter_attack, transition, broken_play`)
     - identity tags only from known org members
  5. De-duplicate against existing tags and existing suggestions.
  6. Upsert suggestions into `segment_tag_suggestions` with:
     - `status = pending`
     - `source = ai`
     - optional `narration_id`, optional `tagged_profile_id` for identity tags
- Output:
  - `suggested_tags` (new pending suggestions)
  - `skipped_tags` (already existing/suggested or invalid)

### 1.6 How auto tags are surfaced in the Narration Panel, and when they become real tags
- In match review, suggestions are loaded with `useSegmentTagSuggestions`, which reads from `segment_tag_suggestions` per segment.
- The Narration Panel UI (`MediaAssetReviewNarrationList.vue`) shows:
  - **Suggested by AI** chips for suggestions where `status = pending`
  - an **Apply all** button that emits `applySuggestedTags(..., applyAll: true)`
  - per-suggestion reject (`X`) actions
- Important current behavior: suggestions are **not** real segment tags yet.

Manual application flow:
1. User clicks **Apply all** (or applies selected suggestions through the same review endpoint path).
2. `segmentTagSuggestionService.applySuggestions(...)` calls `review-segment-tag-suggestions` with `action: "apply"`.
3. That function inserts accepted records into `segment_tags` and then removes the applied rows from `segment_tag_suggestions`.
4. UI reloads both tables (`reloadSegmentTags()` + `reloadSegmentTagSuggestions()`), so accepted tags move from “Suggested by AI” to the actual segment tag list.

Reject flow:
- Rejecting a suggestion calls `review-segment-tag-suggestions` with `action: "reject"`, which deletes those suggestion rows without creating `segment_tags`.

Table separation (current manual model):
- `segment_tag_suggestions` = AI proposal queue (`pending` suggestions for human review).
- `segment_tags` = canonical applied tags used as actual segment metadata.
- Because tables are separate, auto-tagging alone only proposes tags; **human apply is required** to persist them as canonical `segment_tags`.

---

## 2) Narration embeddings and search indexing

### 2.1 Narration embedding generation
Immediately after narration insert, client triggers (fire-and-forget):
- Edge function: `generate-narration-embedding`

`generate-narration-embedding` behavior:
- Loads narration transcript (`transcript_clean` fallback `transcript_raw`).
- Generates embedding with OpenAI `text-embedding-3-small` (1536 dims).
- Writes vector to `narrations.embedding`.
- Skips if already embedded (unless `force=true`).
- Supports optional backfill mode for missing embeddings.

### 2.2 Query embedding generation
For user search queries:
- Edge function: `generate-query-embedding`
- Requires authenticated org member role.
- Generates 1536-dim embedding (`text-embedding-3-small`) from `query_text`.

---

## 3) Segment-level and match-level summary generation

Summaries are generated by two separate edge functions and persisted in two separate tables.
Also embedded.

## 3A) Segment insight summary (`segment_insights`)

Function: `summarize-media-segment`

Input and access:
- POST with `media_segment_id` (and optional `mode`, `force_refresh`).
- Requires authenticated org member role.

Current behavior:
1. Load segment + parent media asset.
2. Load all narrations for that segment.
3. Build structured context (segment bounds, narrator role mix, narration text).
4. If no narrations: returns `state: "empty"`.
5. If `mode=state`: returns state without generation.
6. If active insight exists and not force-refresh:
   - returns existing insight
   - computes `is_stale` based on narration count drift (`>= max(1, ceil(base*0.4))`).
7. Otherwise, call OpenAI (`gpt-4.1-mini` default, JSON response) to produce:
   - `insight_headline`
   - `insight_sentence`
   - `coach_script`
8. Generate embedding text from insight fields and write `segment_insights.embedding`.
9. Upsert active insight row and clean older duplicates for same segment.

Output includes `narration_count_at_generation`, `narration_count_current`, and stale status.

## 3B) Match intelligence summary (`match_intelligence`)

Function: `summarize-media-asset`

Input and access:
- POST with `media_asset_id` (and optional `mode`, `force_refresh`).
- Requires authenticated org **staff+** role.

Current behavior:
1. Load media asset + org scope.
2. Load segments and all narrations for match.
3. Build match-level context across narrations.
4. State tiers:
   - `empty`: 0 narrations
   - `light`: < 25 narrations (returns state only; no AI summary generation)
   - `normal`: >= 25 narrations (eligible for generation)
5. If `mode=state`: return state only.
6. If active summary exists and not force-refresh:
   - returns existing summary
   - computes `is_stale` with threshold `>= max(5, ceil(base*0.2))`.
7. Otherwise call OpenAI (`gpt-4.1-mini` default, JSON) for:
   - `match_headline`
   - `match_summary` (array)
   - section summaries (`set_piece`, `territory`, `possession`, `defence`, `kick_battle`, `scoring`)
8. Generate embedding for the structured summary and write to `match_intelligence.embedding`.
9. Upsert active match summary and clean older duplicates for same media asset.

---

## 4) Hybrid narration search (keyword + semantic)

### 4.1 Frontend flow
`useNarrationSearch`:
1. Debounced query.
2. Calls `narrationService.generateSearchEmbedding(...)`.
3. Calls RPC `search_narrations_hybrid` (org scoped).
4. Maps returned narration/segment IDs to visible segment results.

### 4.2 Match-scoped hybrid SQL used in RAG
RPC: `search_narrations_hybrid_match(query_text, query_embedding, match_count, org_id_filter, media_asset_id_filter)`

Logic:
- Security guard: user must be org member (`auth.uid()` + `org_members`).
- Semantic candidate set:
  - similarity score = `1 - (embedding <=> query_embedding)`
  - threshold: `> 0.33`
  - top `match_count * 2`
- Lexical candidate set:
  - `ts_rank(transcript_tsv, plainto_tsquery('simple', query_text))`
  - requires text match in `transcript_tsv`
  - top `match_count * 2`
- Combine semantic + lexical with `UNION ALL`.
- Group by narration and keep `MAX(score)`.
- Return top `match_count`.

This is the core “hybrid search” path: vector similarity + full-text relevance merged into one ranked result set.

---

## 5) Hybrid retrieval + RAG answering (`ask-match-rag`)

Function: `ask-match-rag`

Input and access:
- POST with `media_asset_id`, `query`, optional `k_narrations`, `k_segment_insights`.
- Requires authenticated org member role and `x-org-id` header.

### 5.1 Retrieval phase (hybrid + semantic)
1. Generate query embedding.
2. Retrieve top narrations via `search_narrations_hybrid_match` (hybrid lexical+semantic).
3. Retrieve top segment insights via `search_segment_insights_semantic` (vector similarity).
4. Retrieve match intelligence via `search_match_intelligence_semantic` (top 1 vector match).

### 5.2 Evidence gating and bundle assembly
- Evidence count = narrations + segment insights.
- If evidence count < 5:
  - returns low-confidence fallback:
    - `"Not enough coach notes yet to answer confidently."`
- Otherwise:
  - build evidence bundle including IDs, text snippets, scores, and summary context.

### 5.3 Generation phase
- Calls OpenAI chat completions (`OPENAI_RAG_MODEL`, default `gpt-4.1-mini`) with:
  - strict system rules: use only provided evidence, no speculation, cite evidence IDs.
  - JSON-only response schema:
    - `answer`
    - `key_points[{ point, evidence[] }]`
    - `recommended_clips[{ media_segment_id, reason, evidence[] }]`

### 5.4 Post-processing and response shaping
- Parse/validate JSON.
- Filter recommended clips to known retrieved segment IDs.
- Enrich clips with segment metadata (`segment_index`, `start_seconds`, `end_seconds`, thumbnail path).
- Compute confidence:
  - low if evidence < 5
  - high if evidence >= 12 and best score >= 0.45
  - otherwise medium
- Return:
  - answer + key points + recommended clips
  - confidence / insufficient_evidence
  - underlying evidence payloads

---

## 6) End-to-end sequence summary

1. Coach records narration on a segment (or system chooses/creates segment in match review).
2. Audio -> `transcribe-webm-file` -> Whisper transcript.
3. `createNarration` writes narration row under RLS.
4. Match review flow can trigger `auto-tag-segment`, producing pending AI tag suggestions in `segment_tag_suggestions`.
5. `generate-narration-embedding` stores vector embedding.
6. Segment summary (`summarize-media-segment`) can generate/update `segment_insights`.
7. Match summary (`summarize-media-asset`) can generate/update `match_intelligence` (when narration volume is sufficient).
8. Search uses hybrid retrieval (lexical + semantic) plus semantic retrieval over insights/intelligence.
9. `ask-match-rag` builds evidence bundle and generates grounded JSON answers + recommended clips.

This is the current “narration -> insights -> retrieval -> RAG answer” system in production code.

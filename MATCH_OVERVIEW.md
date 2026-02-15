# MatchOverview Reference

This document describes every section of the Match Overview page, the RPCs it uses, and when AI/LLM calls occur.

## Location & routing
- **View**: `frontend/src/modules/matchOverview/views/MatchOverviewView.vue`
- **Route**: `frontend/src/router/orgRoutes.ts` → `/organizations/:slug/media/:mediaAssetId/overview`
- **Module**: `frontend/src/modules/matchOverview/` (types, service, composables, blocks)

## Data flow (typical load)
1. Route loads `MatchOverviewView.vue`.
2. `useMatchOverview` calls `matchOverviewService.getOverview(...)`.
3. `matchOverviewService` calls **RPC** `rpc_get_match_overview_v1` with:
   - `p_org_id` (active org)
   - `p_media_asset_id` (match id)
   - `p_trend_window = 3`
   - `p_feed_limit = 20`
4. RPC returns a single JSON payload with story, patterns, player impact, trends, and intelligence feed.
5. Blocks render from the payload.

## AI / LLM usage
- **No AI call on page load.**
- **Only AI call in MatchOverview** is when the user clicks **“Generate match story.”**
  - This triggers `analysisService.getMatchSummary(..., { forceRefresh: true, skipCache: true })`
  - Which calls the Edge Function `summarize-media-asset` (LLM-backed) and writes to `match_intelligence`.
  - After generation, the view refreshes the overview RPC data.
- **Segment insights** shown in the Intelligence Feed are read from `segment_insights` which are generated elsewhere (Edge Function `summarize-media-segment`), not by MatchOverview.

## RPCs involved
### 1) `rpc_get_match_overview_v1`
- **Called by UI** (MatchOverview view).
- **File**: `supabase/rpc_get_match_overview_v1.sql`
- **Returns**: single JSON payload with:
  - `match` metadata
  - `counts` (segment + narration counts)
  - `story` (summary, momentum timeline, themes)
  - `tactical_patterns` (set pieces, actions, transitions)
  - `player_impact` (identity tags + counts + top actions)
  - `trends` (vs recent matches)
  - `intelligence_feed` (segment insights)

### 2) `rpc_get_match_overview_trends_v1`
- **Not called by UI yet** (available for future split).
- **File**: `supabase/rpc_get_match_overview_trends_v1.sql`
- **Returns**: JSON array of trend metrics (same shape as in overview payload).

### 3) `rpc_get_match_intelligence_feed_v1`
- **Not called by UI yet** (available for future split).
- **File**: `supabase/rpc_get_match_intelligence_feed_v1.sql`
- **Returns**: JSON array of intelligence feed items (same shape as in overview payload).

## Section-by-section breakdown (what it shows + how it’s computed)

### Header (Match metadata)
- **Source**: `match` + `counts` in `rpc_get_match_overview_v1`.
- **Displays**:
  - Match title (derived from `media_assets.file_name` → `formatMediaAssetNameForDisplay`)
  - Match date (`media_assets.created_at`)
  - `counts.narration_count` (total narrations for the match)
  - `counts.segment_count` (total segments for the match)
- **Action**: “Refresh overview” triggers `useMatchOverview.reload({ forceRefresh: true })`.

### Match Story (MatchStoryBlock)
- **File**: `frontend/src/modules/matchOverview/components/MatchStoryBlock.vue`
- **Data**:
  - `story.summary` (from `match_intelligence` table via RPC)
  - `story.momentum_timeline` (timeline buckets)
  - `story.themes` (top tag themes)
- **What it shows**:
  - **Match Summary** (MatchSummaryBlock):
    - `summary.match_headline`
    - `summary.match_summary[]`
    - `summary.sections` (set_piece/territory/possession/defence/kick_battle/scoring)
    - `summary.narration_count_at_generation`
  - **Momentum Timeline**:
    - 5-minute buckets (`bucket_start_seconds`, `bucket_end_seconds`)
    - `segment_count` per bucket
    - `narration_count` per bucket
  - **Key Themes**:
    - Up to 6 most frequent **action/context** tag keys
    - `evidence.tag_keys` and `evidence.narration_count`
- **AI**: Summary is generated only via “Generate match story” button.

### Tactical Patterns (TacticalPatternsBlock)
- **File**: `frontend/src/modules/matchOverview/components/TacticalPatternsBlock.vue`
- **Data**: `tactical_patterns` from RPC.
- **Stats shown**:
  - **Set pieces**:
    - Counts and % of segments tagged with `context` keys: `scrum`, `lineout`, `kickoff`, `restart`
  - **Actions**:
    - Top 10 action tags (by segment count)
  - **Transitions**:
    - Counts and % of segments tagged with `context` keys: `exit`, `counter_attack`, `transition`, `broken_play`
- **Computed in RPC**:
  - `tag_counts` grouped by `tag_type` and normalized tag key.
  - Percent = tag segment_count / total match segments.

### Player Impact (PlayerImpactBlock)
- **File**: `frontend/src/modules/matchOverview/components/PlayerImpactBlock.vue`
- **Data**: `player_impact` from RPC.
- **Stats shown (per identity tag key)**:
  - `player_name` (humanized tag key)
  - `segment_count` (segments tagged with that identity)
  - `narration_count` (narrations in those segments)
  - `impact_score` = `segment_count + narration_count`
  - `top_actions` (top 3 action tags within that player’s tagged segments)
- **Computed in RPC**:
  - `identity_tagged_segments` from `segment_tags` (tag_type = `identity`)
  - Narrations joined by segment_id
  - Top actions derived from action tags within identity-tagged segments

### Trends (TrendsBlock)
- **File**: `frontend/src/modules/matchOverview/components/TrendsBlock.vue`
- **Data**: `trends` array from RPC (default window = last 3 matches).
- **Metrics shown**:
  - `narration_count`
  - `action_segments`
  - `set_piece_segments`
  - `transition_segments`
  - `identity_segments`
- **Each metric includes**:
  - `current_value`
  - `baseline_value` (avg of last N matches)
  - `delta_value` (current - baseline)
  - `direction` (`up`, `down`, `flat`)
  - `trend_window` (N)
  - `sample_size` (how many prior matches)
- **Computed in RPC**:
  - Baseline averages from the most recent N matches (excluding the current match).
  - Current metrics computed from tags/narrations of this match.

### Intelligence Feed (IntelligenceFeedBlock)
- **File**: `frontend/src/modules/matchOverview/components/IntelligenceFeedBlock.vue`
- **Data**: `intelligence_feed` from RPC.
- **Stats shown (per insight)**:
  - `segment_index`
  - `start_seconds` / `end_seconds` (displayed as time range)
  - `insight_headline`
  - `insight_sentence`
  - `coach_script`
  - `narration_count_at_generation`
  - `generated_at`
  - `tags` (action/context tags for that segment)
- **Computed in RPC**:
  - `segment_insights` (is_active = true), ordered by generated_at desc
  - Joined with `media_asset_segments` for timing + index
  - Joined with `segment_tags` (action/context only)

## Caching behavior
- `matchOverviewService` caches results in-memory for 5 minutes per `(mediaAssetId, trendWindow, feedLimit)` key.
- `Refresh overview` bypasses cache with `forceRefresh: true`.

## Permission checks
- RPCs enforce org membership using `org_members` + `auth.uid()`.
- “Generate match story” button requires org access at **staff** or higher (`hasOrgAccess`).

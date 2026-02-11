You are helping design and implement a new Match Overview page for RugbyCodex.

RugbyCodex is a rugby video intelligence platform where:
- Matches are uploaded as media assets
- Matches are broken into media_segments
- Coaches and analysts add narrations to segments
- Segments can have tags (action tags, set piece tags, context tags)
- Segments can also have identity tags (player identity / username)
- The system generates AI summaries and segment insights
- We track narration counts and regenerate summaries if underlying data changes

Existing Page:
OrgMediaAssetReviewView.vue
Used for:
- Watching match video
- Adding narrations
- Generating match intelligence

FeedView.vue
Used for:
- Viewing created playlists
- Viewing assingments to groups or players or team-wide
- Can generate segment_insight and can playback coach_script using elevenlabs TTS
- swipe interface for viewing media_segments in different modes.

We now want a POST-REVIEW Match Overview page.

---

PRODUCT GOAL

The Match Overview page should answer:

If a coach has 5 minutes before training, what do they need to know about this match?

The page should surface:
1. Match Story (AI match summary, key themes, momentum timeline)
2. Tactical Patterns (set piece performance, action distributions, transition performance)
3. Player Impact (identity tag involvement, key player trends, high impact players)
4. Trends vs Previous Matches (if data exists)
5. Intelligence Feed (saved insights + generated insights + regenerated summaries)

This is NOT just raw stats. It is interpreted insights backed by data.

---

DOMAIN CONCEPTS

MediaAsset = Match
MediaSegment = Clip / Phase Window

Tags have types:
- action (carry/kick/etc..)
- context (kickoff/exit/restarts/scrum/lineouts..)
- identity (player names)

"""
(Set Piece / Restarts)
scrum
lineout
kickoff
restart

(Action)
carry
pass
kick
tackle
breakdown
maul

(Context)
exit
counter attack
transition
broken play
"""

Narrations contain:
- coach text
- timestamps
- sometimes player names
- tactical descriptions- can be multiple narrations over a single media_segment from different coaches or analysts

Insights:
- Generated from segments
- Have narration counts
- Can be regenerated when data change22

---

ARCHITECTURE EXPECTATIONS

Frontend:
Vue (module-based)
We prefer:
- composables for data loading
- RPC calls via existing client pattern
- domain-based modules

Backend:
Postgres + RPC functions
Existing hybrid search:
- IVFFLAT keyword
- embeddings vector search

We prefer:
- Add new RPCs for aggregated match intelligence
- Avoid doing heavy aggregation in frontend
- Push pattern detection and aggregation into services or SQL where possible

---

WHAT I WANT YOU TO DO

1. Propose:
   - New backend RPCs needed
   - New service layer functions needed
   - New database views or materialized views if helpful

2. Design data contracts:
   - MatchOverviewDTO
   - PlayerImpactDTO
   - MatchTrendDTO
   - MatchThemeDTO

3. Suggest:
   - Frontend module structure
   - Composables needed
   - Caching strategy if relevant

4. Show example:
   - RPC SQL skeleton
   - Service function signatures
   - Vue composable skeleton
   - Page component skeleton

5. Assume scale:
   Matches can have thousands of segments and narrations.

6. Prefer:
   Pre-aggregated match intelligence where possible.

---

IMPORTANT CONSTRAINTS

Do NOT:
- Put heavy aggregation loops in Vue
- Query segments individually for analytics
- Mix identity tags and action tags without type separation

DO:
- Design for future ML tagging and pattern detection
- Design so we can add "match identity model" later
- Keep RPC outputs stable and versionable

---

OUTPUT FORMAT

First:
High level architecture proposal

Then:
Backend additions (RPCs, services, views)

Then:
Frontend additions (modules, composables, page layout)

Then:
Example code skeletons

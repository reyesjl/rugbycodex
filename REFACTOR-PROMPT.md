You are refactoring an existing rugby match analysis UI that displays narrated video segments with tags, filters, and a match summary.

GOAL  
Redesign the UI to follow Swiss design principles: minimal, grid-based, typographically clear, low-contrast, information-dense but calm.  
The result should feel like a professional intelligence tool, not an admin panel.

HARD REQUIREMENTS (DO NOT BREAK)  
- Clicking a narration row must still jump the video player to that segment’s start time.  
- While the video is playing, the UI must always highlight the closest active narration whose time range contains the current playback time.  
- The active narration must be visually distinct and labeled “Now” (retain this semantic concept, but redesign its styling).  
- Existing filters must continue to work:
  - Source filters (All, Coach, Staff, Member, AI, Empty)  
  - Tag filters  
  - Text search over narrations  
- Users must still be able to:
  - Add a narration  
  - Assign narration  
  - Add tags  
  - Edit and delete narrations  
  - Expand/collapse narration details  
- Match Summary must remain, but should feel visually and conceptually connected to the narrations.

DESIGN DIRECTION  
- Use a strict vertical rhythm and consistent spacing scale (e.g., 4px or 8px increments).  
- Replace pill-heavy, colorful chips with:
  - Muted, grayscale tags by default  
  - Subtle accent color only for active filters and the active narration  
- Reduce visual noise:
  - No rainbow tag colors  
  - No excessive borders or gradients  
  - Use whitespace instead of separators  
- Emphasize typography hierarchy:
  - Time range = primary anchor  
  - Key action phrases = bolded or highlighted  
  - Metadata (source, timestamps, owner) = secondary, low-contrast  
- Treat narrations as first-class semantic objects:
  - Highlight entities: players, actions, phases, outcomes  
  - Make action words (kick, turnover, lineout, ruck) visually scannable  
  - Allow inline tag interaction (clickable terms if feasible)  

LAYOUT STRUCTURE  
1) Match Summary  
- Render as a clean, collapsible card.  
- Each bullet should optionally link to related narrations (anchor count or hover preview).  
- Add a subtle divider or title row: “Analysis → Evidence”.

2) Primary Search  
- One dominant search bar: “Search plays, actions, patterns…”  
- All filters move into a secondary row or collapsible filter panel.  

3) Filters  
- Group tags by category (set piece, contact, transition, attack, defense).  
- Active filters appear as a slim “active filters” strip.  
- All tags collapsed by default behind a “Tags” toggle.  

4) Narration List  
Each narration row must:
- Be fully clickable (jump to segment).  
- Use a 2–3 column grid:
  - Column 1: Time range (bold) + “Now” badge when active  
  - Column 2: Narration text with auto-bolded key terms  
  - Column 3: Actions (⋯ menu: Edit, Delete, Assign, Tag, Expand)  
- Visually differentiate:
  - AI vs Staff vs Coach narrations  
  - Low-value narrations (e.g., pre-kickoff walking) collapsed by default  
- Active narration styling:
  - Subtle background tint (not bright yellow)  
  - Left accent bar  
  - “Now” badge in muted accent color  

INTERACTION BEHAVIOR  
- Smooth scroll to active narration as video plays.  
- Debounce scroll updates to avoid jitter.  
- Hover state reveals quick actions (Edit, Tag, Expand).  
- Expand mode shows:
  - Full narration text  
  - Tags  
  - Metadata (author, created date)  
  - Related clips (if available)  

IMPLEMENTATION NOTES  
- Preserve all existing state logic and APIs.  
- Refactor styling into a design-token system:
  - Spacing  
  - Typography  
  - Colors  
- Prefer CSS Grid or Flexbox over nested div stacks.  
- Extract NarrationRow into its own component.  
- Extract Filters into its own component.  
- Extract MatchSummary into its own component.  
- Ensure dark-mode friendly contrast ratios.  
- Avoid introducing new dependencies unless strictly necessary.

QUALITY BAR  
This should look like a calm, professional sports intelligence tool used by coaches and analysts under time pressure.  
It must be faster to scan, easier to filter, and visually quieter than the current version.  
No regressions in functionality.  
No visual gimmicks.  
Minimal. Precise. Purposeful.

Proceed with a full UI refactor while keeping existing behavior intact.

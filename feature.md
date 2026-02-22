You are a senior systems architect and NLP engineer reviewing this codebase.

Your task is to analyze the current infrastructure related to:

- auto-tag-segment (entity + event extraction from narrations)
- match_intelligence (LLM-generated match-level insights)
- segment_insight (LLM-generated segment summaries)
- narration storage and retrieval
- tag suggestion storage (segment_tag_suggestions)
- any taxonomy or static lists used for tagging

Context:

Currently:
- auto-tag-segment uses a static, hardcoded list of action_tags and context_tags.
- The LLM is prompted with this short static list.
- The function loads all narrations for a segment and one-shot prompts the LLM to extract tags.
- segment_insight summarizes all narrations for a segment via a one-shot LLM call.
- match_intelligence summarizes at match level via a one-shot LLM call.
- There is no formal taxonomy table — tags are strings.
- Entity resolution (identity_tags) is constrained by org members but still string-based.
- There is no structured event model (just tags and summaries).

Goals:

We want to evolve this system into:
1. A structured taxonomy-driven event model.
2. Strong entity resolution (players, roles, possibly jersey numbers).
3. Structured attributes (e.g., kick_type, breakdown_outcome, gainline, etc).
4. Evidence-based extraction (narration index references).
5. Versioned ontology (taxonomy_versions).
6. Improved search capabilities (semantic + structured filters).
7. Reduced redundancy between segment_insight, match_intelligence, and auto-tag-segment.
8. A clear separation between:
   - Summarization
   - Event extraction
   - Entity resolution
   - Intelligence aggregation

Your tasks:

1. Map current flow:
   - How narrations flow into auto-tag-segment
   - How tags are validated and stored
   - How segment_insight is generated
   - How match_intelligence is generated
   - Identify duplication in LLM calls

2. Identify architectural weaknesses:
   - Static tag lists
   - No taxonomy versioning
   - No structured event schema
   - Overuse of one-shot prompting
   - Lack of incremental updates
   - Lack of confidence/evidence storage
   - Weak canonicalization

3. Propose a refactor plan with phases:
   Phase 1: Introduce taxonomy tables (taxonomy_versions, taxonomy_tags, taxonomy_attributes, etc)
   Phase 2: Convert tags from strings to structured objects
   Phase 3: Add evidence + confidence to extraction
   Phase 4: Split summarization vs extraction responsibilities
   Phase 5: Introduce incremental reprocessing and hashing
   Phase 6: Introduce structured event table separate from tags

4. Design a future data model:
   - taxonomy_versions
   - taxonomy_tags
   - taxonomy_attributes
   - taxonomy_attribute_values
   - events (structured event instances per segment)
   - event_participants (resolved player identities)
   - segment_tag_suggestions (with confidence, evidence)
   - segment_insight (versioned, structured)
   - match_intelligence (derived from events, not raw narration)

5. Propose a clean separation of concerns:
   - Edge functions responsibilities
   - LLM prompting layer
   - Validation layer
   - Canonicalization layer
   - Frontend responsibilities

6. Propose how to evolve from:
   "Narration -> tags + summary"
   to:
   "Narration -> structured events -> tags (derived) -> segment summary (derived) -> match intelligence (derived)"

7. Suggest improvements to:
   - Search capabilities (hybrid semantic + structured filters)
   - Incremental processing (only reprocess when narrations change)
   - Model versioning and ontology versioning
   - Logging accepted/rejected suggestions for evaluation

Output requirements:

- Provide a structured architectural report.
- Include diagrams in text form where helpful.
- Be specific about migration strategy without breaking existing data.
- Do not suggest a full rewrite; propose incremental steps.
- Focus on robustness, versioning, and long-term scalability.
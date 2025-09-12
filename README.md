# RugbyCodex

RugbyCodex is a multi-tenant video intelligence platform for rugby unions, clubs, coaches, and players.  
It ingests raw rugby footage, processes it into structured clips, and enables AI-powered search, sequencing, and analysis—turning unstructured match video into actionable insights for player development, tactical planning, and high-performance analysis.

---

## Core Concept

Modern rugby generates hours of video per session. Coaches and analysts spend disproportionate time cutting, tagging, and organizing clips. RugbyCodex automates this pipeline:  

- Ingest raw video into secure, organization-scoped storage.  
- Process footage into searchable 30-second clips with transcripts, AI-generated metadata, and semantic embeddings.  
- Enrich clips with coach narrations, annotations, and tactical context.  
- Search and sequence clips into playlists, highlight reels, or training reports.  
- Deliver curated insights to coaches, players, and unions with role-based permissions.  

---

## Core Features

- Multi-Tenant Architecture: Isolated orgs, teams, and users with role-based permissions (Admin, Analyst, Coach, Player).  
- Media Processing: Automated chunking, Whisper-based transcription, AI summaries, and metadata tagging.  
- Semantic Search: Natural language queries powered by OpenAI embeddings + pgvector.  
- Sequencing Tools: Build custom training modules or highlight reels by combining multiple clips.  
- Coach Narration: Voice-over context aligned to clips; transcribed and versioned for reference.  
- Annotations and Metadata: Rich tagging for skills, tactics, and match events, standardized with the RugbyCodex controlled vocabulary.  
- Audit and Security: Full event logging, visibility controls, and per-org data isolation.  

---

## High-Level Architecture

```plaintext
            ┌─────────────────────────┐
            │         Upload          │
            │   (Analyst → S3)        │
            └───────────┬─────────────┘
                        │
                        ▼
              ┌───────────────────┐
              │ Processing Engine │
              │ - Chunking (30s)  │
              │ - Whisper API     │
              │ - Metadata AI     │
              └─────────┬─────────┘
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────────┐
│   Postgres    │ │     S3        │ │   pgvector Index  │
│ (Orgs, Clips, │ │ (Raw/Clips,   │ │ (Semantic Search) │
│ Metadata, etc)│ │ Narrations)   │ │                   │
└──────┬────────┘ └──────┬────────┘ └──────────┬────────┘
       │                 │                     │
       ▼                 ▼                     ▼
 ┌───────────────┐ ┌───────────────┐   ┌───────────────┐
 │  Web App      │ │ Search API     │   │ Sequences /   │
 │ (Coaches,     │ │ (Clips, Tags,  │   │ Dashboards    │
 │ Players, etc) │ │ Vocabulary)    │   │               │
 └───────────────┘ └───────────────┘   └───────────────┘
```

---

## Controlled Vocabulary

Consistent tagging and search depends on a shared rugby language. RugbyCodex maintains a controlled vocabulary covering:

- Standards: Team culture and behaviours.  
- Core Skills: Universal rugby skills.  
- Specialist Skills: Position-specific abilities.  
- Tactical Concepts: Shapes, defensive systems, exit strategies, red-zone tactics.  
- Events: Match moments such as scoring, set piece, and ruck events.  
- Positions: Forwards and Backs by role.  
- Context and Metadata: Match ID, timestamp, score state, weather, momentum shifts.  

See the full [Controlled Vocabulary Document](./docs/controlled-vocabulary.md).

---

## Core Data Model

Based on the roadmap and requirements doc, RugbyCodex models the following objects and relationships in Postgres:

- Organizations: orgs, teams, users, memberships(role).  
- Media Assets: media_assets (s3_key, duration, org_id, visibility, status).  
- Clips and Transcripts: clips, transcripts.  
- Metadata: metadata (summary, key_phrases JSONB, actions JSONB, timestamps JSONB).  
- Narrations and Annotations: narrations, annotations.  
- Embeddings: embeddings (pgvector).  
- Sequences: sequences, sequence_items.  
- Audit and Policies: audit_events, policies.  
- Job Queue: jobs (idempotency, type, status, payload, result).  

---

## Roadmap Context

The RugbyCodex roadmap is iterative, focusing first on data and media infrastructure, then AI workflows, and finally coaching/user features:

1. Foundation: Postgres schema, S3 storage, pgvector search.  
2. Processing Engine: Video chunking, Whisper transcription, AI metadata generation.  
3. Coach Tools: Narrations, annotations, sequences, and reporting.  
4. Player Access: Role-based search with restricted clip visibility.  
5. Scaling and Optimization: GPU-aware Whisper worker pools, bulk transcription, audit and compliance.  
6. Future Expansion: Multi-audio tracks, provenance/versioning, integrations with union sponsors and broadcast partners.  

---

## Success Metrics

- Clip retrieval under 1 second.  
- 1 hour of video transcribed in under 5 minutes.  
- At least 80% coach adoption of human annotations/narration within 1 week of upload.  

---

## References

- [Project Requirements v1.0](./docs/rugbycodex-project-requirements.md)  
- [Controlled Vocabulary](./docs/controlled-vocabulary.md)  
- [Roadmap](./docs/roadmap.md)  

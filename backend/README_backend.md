Backend (FastAPI) – RugbyCodex

Overview
- Purpose: Provide a simple, tenancy-aware REST API with JWT auth, policy gates, and CRUD endpoints for all schema entities.
- Stack: Python 3.11+, FastAPI, Uvicorn, Psycopg 3, PyJWT, Pydantic, Hypothesis, Pytest.

Quickstart
1) Create and activate a virtualenv, then install deps:
   - python -m venv .venv && source .venv/bin/activate
   - pip install -r requirements.txt
2) Set environment variables (see .env.example):
   - export DATABASE_URL='postgresql://user:pass@host:port/db?sslmode=require'
   - export JWT_SECRET='dev-secret'  # replace in prod
   - export JWT_ISSUER='rugbycodex'
3) Run the API:
   - uvicorn --env-file .env app.main:app --reload

Auth Model
- JWT payload must include: sub (user_id UUID), org_id (UUID), role (admin|analyst|coach|player).
- Optional: team_id (UUID). Additional org policy lookups are read from policies table (name: 'player_access' or 'visibility').

Policy Gates
- canRead: Enforces org isolation by default (record.org_id == jwt.org_id). For clips: players are restricted to self-tagged clips or curated-library exceptions per org policy.
- canAnnotate: admin|analyst|coach; also org-scoped.
- canAdminOrg: admin only.
- Visibility toggles: read policy from policies.rules JSON.

Endpoints
- Public base: `/api/v1`
  - Specialized: `/api/v1/clips` (player restrictions, curated exceptions)
  - Dedicated CRUD per resource under `/api/v1/{resource}` (excluding clips):
    organizations, teams, users, memberships, vocab_terms, media_assets, clip_tags, transcripts, clip_metadata, narrations, annotations, embeddings, sequences, sequence_items, policies, jobs
  - Read-only: `/api/v1/audit_events`
- Admin-only generic CRUD: `/api/admin/{resource}` (admin role required)

Routing snippet
- Base paths: `/api/v1` (public), `/api/admin` (admin-only)
- JWT claims: `sub`, `org_id`, `role`, optional `team_id`
- Example
  - GET `/api/v1/clips?limit=20`
  - POST `/api/v1/vocab_terms` with JSON body `{ "category": "Attack Events", "term": "Line Break" }`
  - Admin: GET `/api/admin/jobs`

More details: see `docs/README_API.md`.

Notes
- No S3 integration is implemented here; media fields like s3_key are handled as strings only.
- Embeddings endpoints exist but do not create vector indexes; manage those through SQL helpers.
- Tests include policy unit tests and property-based tests (Hypothesis). Add DB integration tests when a test database is available.

-- ===================================================================
-- RugbyCodex - Initial Schema (Postgres 17 + pgvector)
-- ===================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS vector;       -- pgvector
CREATE EXTENSION IF NOT EXISTS citext;       -- case-insensitive text

-- ===================================================================
-- ENUMS
-- ===================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin','analyst','coach','player');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM ('queued','running','succeeded','failed','canceled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_type') THEN
    CREATE TYPE job_type AS ENUM ('ingest','chunk','transcribe','summarize','embed','narration_transcribe','reindex');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility') THEN
    CREATE TYPE visibility AS ENUM ('private','team','org','public');
  END IF;
END $$;

-- ===================================================================
-- TENANCY & ACCOUNTS
-- ===================================================================
CREATE TABLE IF NOT EXISTS organizations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        CITEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Optional: soft delete
  deleted_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id    UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, user_id, team_id)
);

-- ===================================================================
-- CONTROLLED VOCABULARY / TAXONOMY (for tags aligned to your glossary)
-- Seed from your controlled-vocabulary doc at app start or via migration.
-- ===================================================================
CREATE TABLE IF NOT EXISTS vocab_terms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL,     -- e.g., 'Standards','Core Skills','Tactical Concepts', etc.
  term          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, term)
);

-- ===================================================================
-- MEDIA & CLIPS
-- ===================================================================
CREATE TABLE IF NOT EXISTS media_assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id      UUID REFERENCES teams(id) ON DELETE SET NULL,
  s3_key       TEXT NOT NULL,
  duration_s   NUMERIC(10,3),                -- seconds
  visibility   visibility NOT NULL DEFAULT 'org',
  -- If you want to treat NULL team_id as a specific value for uniqueness, create a unique index after table creation:
  -- CREATE UNIQUE INDEX memberships_org_user_team_idx ON memberships (org_id, user_id, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid));
  meta         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, s3_key)
);

-- 30s CLIPS derived from media
CREATE TABLE IF NOT EXISTS clips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  media_id        UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  start_ms        INTEGER NOT NULL CHECK (start_ms >= 0),
  end_ms          INTEGER NOT NULL CHECK (end_ms > start_ms),
  visibility      visibility NOT NULL DEFAULT 'org',
  -- fast filters
  has_transcript  BOOLEAN NOT NULL DEFAULT FALSE,
  has_summary     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (media_id, start_ms, end_ms)
);

-- Optional many-to-many tag attachment to clips via vocab
CREATE TABLE IF NOT EXISTS clip_tags (
  clip_id    UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  vocab_id   UUID NOT NULL REFERENCES vocab_terms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (clip_id, vocab_id)
);

-- ===================================================================
-- TRANSCRIPTS / SUMMARIES / METADATA
-- ===================================================================
CREATE TABLE IF NOT EXISTS transcripts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id      UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  source       TEXT NOT NULL DEFAULT 'whisper',  -- whisper/openai/etc.
  language     TEXT DEFAULT 'en',
  text         TEXT NOT NULL,
  words        JSONB,           -- optional per-word timings
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clip_id, source)
);

CREATE TABLE IF NOT EXISTS clip_metadata (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id       UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  summary       TEXT,
  key_phrases   JSONB,          -- ["gainline win","line break",...]
  actions       JSONB,          -- structured events/actions
  timestamps    JSONB,          -- { "phases":[{start_ms,end_ms,label}], ... }
  context       JSONB,          -- match id, weather, score state, etc.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================================================================
-- COACH NARRATION & ANNOTATIONS (versionable context layers)
-- ===================================================================
CREATE TABLE IF NOT EXISTS narrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id       UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  coach_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  s3_key        TEXT,           -- audio file in S3
  transcript    TEXT,           -- ASR of narration
  version       INTEGER NOT NULL DEFAULT 1,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clip_id, org_id, coach_id, version)
);

CREATE TABLE IF NOT EXISTS annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id       UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  body          JSONB NOT NULL,       -- freeform marks/boxes/arrows/notes
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================================================================
-- EMBEDDINGS (pgvector)
-- Multiple indexes distinguish by (index_name, version). Partial indexes provided below.
-- ===================================================================
-- Choose a common dimensionality for your model, e.g., 1536 for text-embedding-3-large.
CREATE TABLE IF NOT EXISTS embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  clip_id       UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  index_name    TEXT NOT NULL DEFAULT 'clips',  -- logical index label
  version       INTEGER NOT NULL DEFAULT 1,     -- versioned rebuilds
  dims          INTEGER NOT NULL CHECK (dims > 0),
  embedding     VECTOR,                         -- store as variable-dim; validate via CHECK below
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clip_id, index_name, version)
);

-- Ensure vector length matches dims (runtime guard)
ALTER TABLE embeddings
  ADD CONSTRAINT embeddings_dims_match
  CHECK (embedding IS NULL OR vector_dims(embedding) = dims);

-- Fast lookups per tenant and index/version combo
CREATE INDEX IF NOT EXISTS embeddings_org_idx
  ON embeddings(org_id);

CREATE INDEX IF NOT EXISTS embeddings_clip_idx
  ON embeddings(clip_id);

-- Template unique key for routing queries
CREATE INDEX IF NOT EXISTS embeddings_index_version_idx
  ON embeddings(index_name, version);

-- ===================================================================
-- SEQUENCES (playlists/highlights) & ITEMS
-- ===================================================================
CREATE TABLE IF NOT EXISTS sequences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  visibility    visibility NOT NULL DEFAULT 'team',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sequence_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id   UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  clip_id       UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL CHECK (position > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, position),
  UNIQUE (sequence_id, clip_id)
);

-- ===================================================================
-- POLICIES & AUDIT
-- ===================================================================
CREATE TABLE IF NOT EXISTS policies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  rules         JSONB NOT NULL,          -- e.g., visibility rules, role gates
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id            BIGSERIAL PRIMARY KEY,
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  subject_type  TEXT,
  subject_id    UUID,
  details       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================================================================
-- JOBS (idempotent processing pipeline)
-- ===================================================================
CREATE TABLE IF NOT EXISTS jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type           job_type NOT NULL,
  status         job_status NOT NULL DEFAULT 'queued',
  payload        JSONB NOT NULL,                 -- inputs
  result         JSONB,                          -- outputs / errors
  idempotency_key TEXT,                          -- to prevent duplicates
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at     TIMESTAMPTZ,
  finished_at    TIMESTAMPTZ,
  UNIQUE (org_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_type_idx ON jobs(type);

-- ===================================================================
-- PERFORMANCE: Partial Vector Indexes by (index_name, version)
-- Create partial IVFFLAT or HNSW per (index_name, version) you actually query.
-- NOTE: pgvector recommends VACUUM/ANALYZE after loading and SET lists for IVFFLAT.
-- ===================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_embeddings_ivfflat_index') THEN
    CREATE OR REPLACE FUNCTION create_embeddings_ivfflat_index(p_index_name TEXT, p_version INT, p_lists INT DEFAULT 100)
    RETURNS VOID
    LANGUAGE plpgsql
    AS $fn$
    DECLARE
      idx_name TEXT := format('emb_%s_v%s_ivf_idx', regexp_replace(p_index_name, '\W+', '_', 'g'), p_version);
      sql TEXT;
    BEGIN
      -- Ensure there is data with the target predicate (avoids empty index on dev)
      sql := format($SQL$
        DO $blk$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM embeddings
            WHERE index_name = %L AND version = %s
          ) THEN
            RAISE NOTICE 'No embeddings yet for (index_name=%, version=%); skipping index creation', %L, %s;
          ELSE
            -- Create the index only if it doesn't already exist
            IF NOT EXISTS (
              SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE c.relname = %L AND n.nspname = current_schema()
            ) THEN
              EXECUTE format(
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS %I ON embeddings USING ivfflat (embedding vector_l2_ops)
                 WITH (lists = %s) WHERE index_name = %L AND version = %s;',
                idx_name, p_lists, p_index_name, p_version
              );
            END IF;
          END IF;
        END
        $blk$;
      $SQL$, p_index_name, p_version, idx_name, idx_name, p_lists, p_index_name, p_version);
      EXECUTE sql;
    END
    $fn$;
  END IF;
END $$;

-- Optional: HNSW variant (fast, memory-heavy). Uncomment to use.
-- DO $$
-- BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_embeddings_hnsw_index') THEN
--     CREATE OR REPLACE FUNCTION create_embeddings_hnsw_index(p_index_name TEXT, p_version INT, p_m INT DEFAULT 16, p_efconstruction INT DEFAULT 64)
--     RETURNS VOID
--     LANGUAGE plpgsql
--     AS $fn$
--     DECLARE
--       idx_name TEXT := format('emb_%s_v%s_hnsw_idx', regexp_replace(p_index_name, '\W+', '_', 'g'), p_version);
--     BEGIN
--       EXECUTE format(
--         'CREATE INDEX CONCURRENTLY IF NOT EXISTS %I ON embeddings USING hnsw (embedding vector_l2_ops)
--          WITH (m = %s, ef_construction = %s) WHERE index_name = %L AND version = %s;',
--          idx_name, p_m, p_efconstruction, p_index_name, p_version
--       );
--     END;
--     $fn$;
--   END IF;
-- END $$;

-- ===================================================================
-- QUERY HELPERS
-- ===================================================================

-- Cosine/L2 helpers (adjust to your chosen metric)
-- Example search: SELECT clip_id FROM embeddings WHERE index_name='clips' AND version=1
-- ORDER BY embedding <-> $1 LIMIT 50;
-- (Bind $1 as a vector)

-- ===================================================================
-- HOUSEKEEPING INDEXES
-- ===================================================================
CREATE INDEX IF NOT EXISTS media_assets_org_idx     ON media_assets(org_id);
CREATE INDEX IF NOT EXISTS media_assets_status_idx  ON media_assets(status);
CREATE INDEX IF NOT EXISTS clips_media_idx          ON clips(media_id);
CREATE INDEX IF NOT EXISTS clips_org_idx            ON clips(org_id);
CREATE INDEX IF NOT EXISTS transcripts_clip_idx     ON transcripts(clip_id);
CREATE INDEX IF NOT EXISTS clip_metadata_clip_idx   ON clip_metadata(clip_id);
CREATE INDEX IF NOT EXISTS narrations_clip_idx      ON narrations(clip_id);
CREATE INDEX IF NOT EXISTS annotations_clip_idx     ON annotations(clip_id);
CREATE INDEX IF NOT EXISTS sequences_org_idx        ON sequences(org_id);
CREATE INDEX IF NOT EXISTS sequence_items_seq_idx   ON sequence_items(sequence_id);
CREATE INDEX IF NOT EXISTS audit_events_org_idx     ON audit_events(org_id);
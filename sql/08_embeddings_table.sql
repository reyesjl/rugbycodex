-- Embeddings table (pgvector)
CREATE TABLE IF NOT EXISTS embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  clip_id       UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  index_name    TEXT NOT NULL DEFAULT 'clips',  -- logical index label
  version       INTEGER NOT NULL DEFAULT 1,     -- versioned rebuilds
  dims          INTEGER NOT NULL CHECK (dims > 0),
  embedding     VECTOR,
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

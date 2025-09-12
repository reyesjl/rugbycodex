-- Media & Clips
CREATE TABLE IF NOT EXISTS media_assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id      UUID REFERENCES teams(id) ON DELETE SET NULL,
  s3_key       TEXT NOT NULL,
  duration_s   NUMERIC(10,3),                -- seconds
  visibility   visibility NOT NULL DEFAULT 'org',
  status       TEXT NOT NULL DEFAULT 'uploaded',  -- 'uploaded','processing','ready','error'
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

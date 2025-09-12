-- Transcripts / Summaries / Metadata
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

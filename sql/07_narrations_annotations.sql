-- Coach Narration & Annotations
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

-- Sequences (playlists/highlights) & items
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

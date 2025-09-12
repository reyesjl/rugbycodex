-- Controlled vocabulary / taxonomy
CREATE TABLE IF NOT EXISTS vocab_terms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL,
  term          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, term)
);

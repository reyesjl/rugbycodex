-- Jobs (idempotent processing pipeline)
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

-- Query helpers (search examples) and housekeeping indexes
-- Example search: SELECT clip_id FROM embeddings WHERE index_name='clips' AND version=1
-- ORDER BY embedding <-> $1 LIMIT 50;
-- (Bind $1 as a vector)

-- Housekeeping indexes
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

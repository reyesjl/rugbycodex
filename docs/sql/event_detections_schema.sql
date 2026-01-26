-- Event Detection Schema
-- Auto-detection of rugby events (scrums, lineouts, trys, kicks) via computer vision
-- Created: 2026-01-26

-- Event type enum
CREATE TYPE event_detection_type AS ENUM ('scrum', 'lineout', 'try', 'kick');

-- Event detections table
CREATE TABLE public.event_detections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL,
  event_type event_detection_type NOT NULL,
  start_seconds double precision NOT NULL CHECK (start_seconds >= 0),
  end_seconds double precision NOT NULL CHECK (end_seconds >= start_seconds),
  confidence_score numeric NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  model_version text NOT NULL,
  metadata jsonb, -- Additional detection data (frame numbers, bounding boxes, etc.)
  verified boolean DEFAULT false, -- Manual verification flag
  verified_by uuid,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  segment_id uuid, -- Optional link to auto-generated segment
  
  CONSTRAINT event_detections_pkey PRIMARY KEY (id),
  CONSTRAINT event_detections_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE,
  CONSTRAINT event_detections_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.profiles(id),
  CONSTRAINT event_detections_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.media_asset_segments(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX idx_event_detections_media_asset ON public.event_detections(media_asset_id);
CREATE INDEX idx_event_detections_event_type ON public.event_detections(event_type);
CREATE INDEX idx_event_detections_confidence ON public.event_detections(confidence_score DESC);
CREATE INDEX idx_event_detections_time ON public.event_detections(media_asset_id, start_seconds);

-- Add new job type to existing job_type enum
-- Note: This assumes job_type enum exists. Adjust if different.
-- ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'event_detection';

-- Comments
COMMENT ON TABLE public.event_detections IS 'Computer vision detected rugby events with confidence scores';
COMMENT ON COLUMN public.event_detections.event_type IS 'Type of rugby event detected: scrum, lineout, try, or kick';
COMMENT ON COLUMN public.event_detections.confidence_score IS 'Model confidence score between 0 and 1';
COMMENT ON COLUMN public.event_detections.model_version IS 'Version identifier of the CV model used for detection';
COMMENT ON COLUMN public.event_detections.metadata IS 'Additional detection metadata (frame numbers, bounding boxes, etc.)';
COMMENT ON COLUMN public.event_detections.verified IS 'Flag indicating if a human has verified this detection';
COMMENT ON COLUMN public.event_detections.segment_id IS 'Optional reference to auto-generated segment for this event';

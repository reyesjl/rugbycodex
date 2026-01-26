-- Add org_id column to event_detections table
-- Run this if you already created the table without org_id

ALTER TABLE public.event_detections 
  ADD COLUMN org_id uuid NOT NULL;

ALTER TABLE public.event_detections
  ADD CONSTRAINT event_detections_org_id_fkey 
  FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add index for org queries
CREATE INDEX idx_event_detections_org ON public.event_detections(org_id);

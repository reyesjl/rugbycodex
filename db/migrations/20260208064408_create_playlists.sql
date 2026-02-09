-- Migration: Create playlists feature tables
-- Description: Adds playlists, playlist_segments, and playlist_tags tables with RLS policies
-- Date: 2026-02-08

-- =============================================
-- Table: playlists
-- =============================================
CREATE TABLE public.playlists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT playlists_pkey PRIMARY KEY (id),
  CONSTRAINT playlists_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT playlists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Index for org queries
CREATE INDEX idx_playlists_org_id ON public.playlists(org_id);
CREATE INDEX idx_playlists_created_by ON public.playlists(created_by);
CREATE INDEX idx_playlists_created_at ON public.playlists(created_at DESC);

-- =============================================
-- Table: playlist_segments
-- =============================================
CREATE TABLE public.playlist_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL,
  media_segment_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT playlist_segments_pkey PRIMARY KEY (id),
  CONSTRAINT playlist_segments_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE CASCADE,
  CONSTRAINT playlist_segments_media_segment_id_fkey FOREIGN KEY (media_segment_id) REFERENCES public.media_asset_segments(id) ON DELETE CASCADE,
  CONSTRAINT playlist_segments_unique UNIQUE (playlist_id, media_segment_id)
);

-- Indexes for queries
CREATE INDEX idx_playlist_segments_playlist_id ON public.playlist_segments(playlist_id);
CREATE INDEX idx_playlist_segments_media_segment_id ON public.playlist_segments(media_segment_id);
CREATE INDEX idx_playlist_segments_sort_order ON public.playlist_segments(playlist_id, sort_order);

-- =============================================
-- Table: playlist_tags
-- =============================================
CREATE TABLE public.playlist_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL,
  tag_key text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT playlist_tags_pkey PRIMARY KEY (id),
  CONSTRAINT playlist_tags_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE CASCADE,
  CONSTRAINT playlist_tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Index for playlist queries
CREATE INDEX idx_playlist_tags_playlist_id ON public.playlist_tags(playlist_id);

-- =============================================
-- RLS Policies: playlists
-- =============================================

-- Enable RLS
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- SELECT: org members can view playlists
CREATE POLICY "Org members can view playlists"
  ON public.playlists
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = playlists.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- INSERT: only owner/manager/staff can create
CREATE POLICY "Owner/manager/staff can create playlists"
  ON public.playlists
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = playlists.org_id
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'manager', 'staff')
    )
  );

-- UPDATE: only owner/manager/staff can update
CREATE POLICY "Owner/manager/staff can update playlists"
  ON public.playlists
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = playlists.org_id
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'manager', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = playlists.org_id
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'manager', 'staff')
    )
  );

-- DELETE: only owner/manager/staff can delete
CREATE POLICY "Owner/manager/staff can delete playlists"
  ON public.playlists
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.org_id = playlists.org_id
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'manager', 'staff')
    )
  );

-- =============================================
-- RLS Policies: playlist_segments
-- =============================================

ALTER TABLE public.playlist_segments ENABLE ROW LEVEL SECURITY;

-- SELECT: org members can view playlist segments
CREATE POLICY "Org members can view playlist segments"
  ON public.playlist_segments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      INNER JOIN public.org_members ON org_members.org_id = playlists.org_id
      WHERE playlists.id = playlist_segments.playlist_id
      AND org_members.user_id = auth.uid()
    )
  );

-- INSERT: only owner/manager/staff can add segments
CREATE POLICY "Owner/manager/staff can add playlist segments"
  ON public.playlist_segments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists
      INNER JOIN public.org_members ON org_members.org_id = playlists.org_id
      WHERE playlists.id = playlist_segments.playlist_id
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'manager', 'staff')
    )
  );

-- UPDATE: only owner/manager/staff can update segments
CREATE POLICY "Owner/manager/staff can update playlist segments"
  ON public.playlist_segments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      INNER JOIN public.org_members ON org_members.org_id = playlists.org_id
      WHERE playlists.id = playlist_segments.playlist_id
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'manager', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists
      INNER JOIN public.org_members ON org_members.org_id = playlists.org_id
      WHERE playlists.id = playlist_segments.playlist_id
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'manager', 'staff')
    )
  );

-- DELETE: only owner/manager/staff can remove segments
CREATE POLICY "Owner/manager/staff can delete playlist segments"
  ON public.playlist_segments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      INNER JOIN public.org_members ON org_members.org_id = playlists.org_id
      WHERE playlists.id = playlist_segments.playlist_id
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'manager', 'staff')
    )
  );

-- =============================================
-- RLS Policies: playlist_tags
-- =============================================

ALTER TABLE public.playlist_tags ENABLE ROW LEVEL SECURITY;

-- SELECT: org members can view playlist tags
CREATE POLICY "Org members can view playlist tags"
  ON public.playlist_tags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      INNER JOIN public.org_members ON org_members.org_id = playlists.org_id
      WHERE playlists.id = playlist_tags.playlist_id
      AND org_members.user_id = auth.uid()
    )
  );

-- INSERT: only owner/manager/staff can add tags
CREATE POLICY "Owner/manager/staff can add playlist tags"
  ON public.playlist_tags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.playlists
      INNER JOIN public.org_members ON org_members.org_id = playlists.org_id
      WHERE playlists.id = playlist_tags.playlist_id
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'manager', 'staff')
    )
  );

-- DELETE: only owner/manager/staff can remove tags
CREATE POLICY "Owner/manager/staff can delete playlist tags"
  ON public.playlist_tags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      INNER JOIN public.org_members ON org_members.org_id = playlists.org_id
      WHERE playlists.id = playlist_tags.playlist_id
      AND org_members.user_id = auth.uid()
      AND org_members.role IN ('owner', 'manager', 'staff')
    )
  );

-- =============================================
-- RPC: Get playlist feed
-- Description: Returns segments for a playlist ordered by sort_order with media asset details
-- =============================================

CREATE OR REPLACE FUNCTION public.rpc_get_playlist_feed(
  p_playlist_id uuid,
  p_org_id uuid
)
RETURNS TABLE (
  playlist_segment_id uuid,
  segment_id uuid,
  segment_index integer,
  start_seconds double precision,
  end_seconds double precision,
  segment_created_at timestamp with time zone,
  sort_order integer,
  media_asset_id uuid,
  media_asset_org_id uuid,
  media_asset_uploader_id uuid,
  media_asset_bucket text,
  media_asset_storage_path text,
  media_asset_streaming_ready boolean,
  media_asset_thumbnail_path text,
  media_asset_file_size_bytes bigint,
  media_asset_mime_type text,
  media_asset_duration_seconds double precision,
  media_asset_checksum text,
  media_asset_source text,
  media_asset_file_name text,
  media_asset_kind media_asset_kind,
  media_asset_status media_asset_status,
  media_asset_created_at timestamp with time zone,
  media_asset_base_org_storage_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.id AS playlist_segment_id,
    mas.id AS segment_id,
    mas.segment_index,
    mas.start_seconds,
    mas.end_seconds,
    mas.created_at AS segment_created_at,
    ps.sort_order,
    ma.id AS media_asset_id,
    ma.org_id AS media_asset_org_id,
    ma.uploader_id AS media_asset_uploader_id,
    ma.bucket AS media_asset_bucket,
    ma.storage_path AS media_asset_storage_path,
    ma.streaming_ready AS media_asset_streaming_ready,
    ma.thumbnail_path AS media_asset_thumbnail_path,
    ma.file_size_bytes AS media_asset_file_size_bytes,
    ma.mime_type AS media_asset_mime_type,
    ma.duration_seconds AS media_asset_duration_seconds,
    ma.checksum AS media_asset_checksum,
    ma.source AS media_asset_source,
    ma.file_name AS media_asset_file_name,
    ma.kind AS media_asset_kind,
    ma.status AS media_asset_status,
    ma.created_at AS media_asset_created_at,
    ma.base_org_storage_path AS media_asset_base_org_storage_path
  FROM public.playlist_segments ps
  INNER JOIN public.media_asset_segments mas ON mas.id = ps.media_segment_id
  INNER JOIN public.media_assets ma ON ma.id = mas.media_asset_id
  INNER JOIN public.playlists p ON p.id = ps.playlist_id
  WHERE ps.playlist_id = p_playlist_id
    AND p.org_id = p_org_id
    AND ma.org_id = p_org_id
  ORDER BY ps.sort_order ASC, ps.created_at ASC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.rpc_get_playlist_feed(uuid, uuid) TO authenticated;

-- =============================================
-- Updated_at trigger for playlists
-- =============================================

CREATE OR REPLACE FUNCTION public.update_playlists_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_playlists_updated_at
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_playlists_updated_at();

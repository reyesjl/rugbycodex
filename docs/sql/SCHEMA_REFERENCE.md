-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.assignment_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assignment_progress_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_progress_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id),
  CONSTRAINT assignment_progress_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.assignment_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  media_segment_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assignment_segments_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_segments_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id),
  CONSTRAINT assignment_segments_media_segment_id_fkey FOREIGN KEY (media_segment_id) REFERENCES public.media_asset_segments(id)
);
CREATE TABLE public.assignment_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  target_type USER-DEFINED NOT NULL,
  target_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assignment_targets_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_targets_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id)
);
CREATE TABLE public.assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  due_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.compute_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  hostname text,
  device_type text NOT NULL DEFAULT 'jetson_orin'::text,
  status USER-DEFINED NOT NULL DEFAULT 'offline'::compute_device_status,
  last_heartbeat_at timestamp with time zone,
  cpu_cores integer,
  memory_total_mb integer,
  gpu_model text,
  cuda_version text,
  jetpack_version text,
  cpu_utilization numeric,
  memory_used_mb integer,
  gpu_utilization numeric,
  temperature_c numeric,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT compute_devices_pkey PRIMARY KEY (id)
);
CREATE TABLE public.group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT group_members_pkey PRIMARY KEY (id),
  CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT group_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  media_asset_id uuid,
  media_asset_segment_id uuid,
  type USER-DEFINED NOT NULL,
  state USER-DEFINED NOT NULL DEFAULT 'queued'::job_state,
  progress numeric NOT NULL DEFAULT 0.0 CHECK (progress >= 0::numeric AND progress <= 1::numeric),
  error_code text,
  error_message text,
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  payload jsonb,
  result jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  narration_id uuid,
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_narration_fkey FOREIGN KEY (narration_id) REFERENCES public.narrations(id),
  CONSTRAINT jobs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT jobs_media_asset_segment_id_fkey FOREIGN KEY (media_asset_segment_id) REFERENCES public.media_asset_segments(id),
  CONSTRAINT jobs_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES public.media_assets(id)
);
CREATE TABLE public.match_intelligence (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'normal'::text,
  match_headline text NOT NULL,
  match_summary ARRAY NOT NULL,
  set_piece text,
  territory text,
  possession text,
  defence text,
  kick_battle text,
  scoring text,
  model text,
  prompt_version text,
  temperature numeric,
  narration_count_at_generation integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  generated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT match_intelligence_pkey PRIMARY KEY (id),
  CONSTRAINT match_intelligence_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES public.media_assets(id)
);
CREATE TABLE public.media_asset_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL,
  segment_index integer NOT NULL CHECK (segment_index >= 0),
  start_seconds double precision NOT NULL CHECK (start_seconds >= 0::double precision),
  end_seconds double precision NOT NULL,
  duration_seconds double precision DEFAULT (end_seconds - start_seconds),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  source_type USER-DEFINED NOT NULL DEFAULT 'auto'::segment_source_type,
  created_by_profile_id uuid,
  CONSTRAINT media_asset_segments_pkey PRIMARY KEY (id),
  CONSTRAINT media_asset_segments_created_by_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT media_asset_segments_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES public.media_assets(id)
);
CREATE TABLE public.media_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  uploader_id uuid NOT NULL,
  bucket text NOT NULL DEFAULT '''rugbycodex''::text'::text,
  storage_path text NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes >= 0),
  mime_type text NOT NULL,
  duration_seconds double precision NOT NULL,
  checksum text NOT NULL,
  source text NOT NULL DEFAULT 'upload'::text,
  file_name text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'intent'::media_asset_status,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  base_org_storage_path text NOT NULL DEFAULT '""'::text,
  kind USER-DEFINED NOT NULL DEFAULT 'match'::media_asset_kind,
  streaming_ready boolean NOT NULL DEFAULT false,
  thumbnail_path text,
  processing_stage USER-DEFINED NOT NULL DEFAULT 'uploaded'::processing_stage,
  transcode_progress integer DEFAULT 0,
  CONSTRAINT media_assets_pkey PRIMARY KEY (id),
  CONSTRAINT media_assets_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT media_assets_uploader_id_fkey FOREIGN KEY (uploader_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.media_cleanup_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL,
  bucket text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  error text,
  CONSTRAINT media_cleanup_jobs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.narrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  media_asset_id uuid NOT NULL,
  media_asset_segment_id uuid NOT NULL,
  author_id uuid,
  audio_storage_path text,
  transcript_raw text NOT NULL,
  transcript_clean text,
  transcript_lang text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  transcript_tsv tsvector DEFAULT to_tsvector('simple'::regconfig, COALESCE(transcript_clean, transcript_raw)),
  source_type USER-DEFINED,
  embedding USER-DEFINED CHECK (embedding IS NULL OR vector_dims(embedding) = 1536),
  CONSTRAINT narrations_pkey PRIMARY KEY (id),
  CONSTRAINT narrations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT narrations_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES public.media_assets(id),
  CONSTRAINT narrations_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id),
  CONSTRAINT narrations_seg_fk FOREIGN KEY (media_asset_segment_id) REFERENCES public.media_asset_segments(id)
);
CREATE TABLE public.org_members (
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'member'::org_role,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT org_members_pkey PRIMARY KEY (org_id, user_id),
  CONSTRAINT org_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT org_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.organization_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  requested_name text NOT NULL,
  requested_type USER-DEFINED NOT NULL DEFAULT 'team'::organization_type,
  message text,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::organization_request_status,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  organization_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organization_requests_pkey PRIMARY KEY (id),
  CONSTRAINT organization_requests_requester_fkey FOREIGN KEY (requester_id) REFERENCES public.profiles(id),
  CONSTRAINT organization_requests_reviewer_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id),
  CONSTRAINT organization_requests_org_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);
CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner uuid,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  storage_limit_mb integer NOT NULL DEFAULT 10240,
  bio text,
  visibility USER-DEFINED NOT NULL DEFAULT 'private'::organization_visibility,
  type USER-DEFINED DEFAULT 'team'::organization_type,
  join_code text NOT NULL,
  join_code_set_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_owner_fkey FOREIGN KEY (owner) REFERENCES public.profiles(id)
);
CREATE TABLE public.playlist_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL,
  media_segment_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT playlist_segments_pkey PRIMARY KEY (id),
  CONSTRAINT playlist_segments_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id),
  CONSTRAINT playlist_segments_media_segment_id_fkey FOREIGN KEY (media_segment_id) REFERENCES public.media_asset_segments(id)
);
CREATE TABLE public.playlist_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL,
  tag_key text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT playlist_tags_pkey PRIMARY KEY (id),
  CONSTRAINT playlist_tags_playlist_id_fkey FOREIGN KEY (playlist_id) REFERENCES public.playlists(id),
  CONSTRAINT playlist_tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.playlists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT playlists_pkey PRIMARY KEY (id),
  CONSTRAINT playlists_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id),
  CONSTRAINT playlists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  xp bigint NOT NULL DEFAULT '0'::bigint,
  creation_time timestamp with time zone DEFAULT now(),
  name text NOT NULL DEFAULT ''::text,
  role USER-DEFINED NOT NULL DEFAULT 'user'::profile_role,
  username text NOT NULL UNIQUE,
  primary_org uuid,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_uuid_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_primary_org_fkey FOREIGN KEY (primary_org) REFERENCES public.organizations(id)
);
CREATE TABLE public.segment_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  media_segment_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'normal'::text,
  insight_headline text NOT NULL,
  insight_sentence text NOT NULL,
  coach_script text,
  confidence text CHECK (confidence = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  model text,
  prompt_version text,
  narration_count_at_generation integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  generated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT segment_insights_pkey PRIMARY KEY (id),
  CONSTRAINT segment_insights_media_segment_id_fkey FOREIGN KEY (media_segment_id) REFERENCES public.media_asset_segments(id)
);
CREATE TABLE public.segment_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  segment_id uuid NOT NULL,
  tag_key text NOT NULL,
  tag_type text NOT NULL CHECK (tag_type = ANY (ARRAY['action'::text, 'context'::text, 'identity'::text])),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT segment_tags_pkey PRIMARY KEY (id),
  CONSTRAINT segment_tags_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES public.media_asset_segments(id),
  CONSTRAINT segment_tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.segment_viewing_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  assignment_id uuid,
  media_asset_id uuid,
  segments_viewed integer NOT NULL DEFAULT 0,
  segments_completed integer NOT NULL DEFAULT 0,
  total_segments integer NOT NULL DEFAULT 0,
  total_time_seconds numeric NOT NULL DEFAULT 0 CHECK (total_time_seconds >= 0::numeric),
  max_video_completion_percent numeric NOT NULL DEFAULT 0 CHECK (max_video_completion_percent >= 0::numeric AND max_video_completion_percent <= 100::numeric),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  CONSTRAINT segment_viewing_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT segment_viewing_sessions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT segment_viewing_sessions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id),
  CONSTRAINT segment_viewing_sessions_media_asset_id_fkey FOREIGN KEY (media_asset_id) REFERENCES public.media_assets(id)
);

export type Playlist = {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
};

export type PlaylistSegment = {
  id: string;
  playlist_id: string;
  media_segment_id: string;
  sort_order: number;
  created_at: Date;
};

export type PlaylistTag = {
  id: string;
  playlist_id: string;
  tag_key: string;
  created_by: string;
  created_at: Date;
};

export type PlaylistListItem = Playlist & {
  segment_count: number;
  tags: PlaylistTag[];
};

export type PlaylistFeedEntry = {
  playlist_segment_id: string;
  segment_id: string;
  segment_index: number;
  start_seconds: number;
  end_seconds: number;
  segment_created_at: Date;
  sort_order: number;
  media_asset_id: string;
  media_asset_org_id: string;
  media_asset_uploader_id: string;
  media_asset_bucket: string;
  media_asset_storage_path: string;
  media_asset_streaming_ready: boolean;
  media_asset_thumbnail_path: string | null;
  media_asset_file_size_bytes: number;
  media_asset_mime_type: string;
  media_asset_duration_seconds: number;
  media_asset_checksum: string;
  media_asset_source: string;
  media_asset_file_name: string;
  media_asset_kind: string;
  media_asset_status: string;
  media_asset_created_at: Date;
  media_asset_base_org_storage_path: string;
};

/**
 * Event Detection Types
 * Auto-detected rugby events via computer vision
 */

/**
 * Rugby event types that can be detected
 */
export type EventDetectionType = 'scrum' | 'lineout' | 'try' | 'kick';

/**
 * Event detection record from database
 */
export interface EventDetection {
  id: string;
  media_asset_id: string;
  event_type: EventDetectionType;
  start_seconds: number;
  end_seconds: number;
  confidence_score: number; // 0-1
  model_version: string;
  metadata?: Record<string, any>; // Frame numbers, bounding boxes, etc.
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  segment_id?: string;
}

/**
 * Event detection filter options
 */
export interface EventDetectionFilter {
  event_types?: EventDetectionType[];
  min_confidence?: number;
  verified_only?: boolean;
}

/**
 * Event detection statistics
 */
export interface EventDetectionStats {
  total: number;
  by_type: Record<EventDetectionType, number>;
  avg_confidence: number;
  verified_count: number;
}

/**
 * Event detection job status
 */
export interface EventDetectionJob {
  job_id: string;
  media_asset_id: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed';
  progress: number;
  error_message?: string;
  started_at?: string;
  finished_at?: string;
}

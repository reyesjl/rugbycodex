import { invokeEdge } from "@/lib/api";
import { handleEdgeFunctionError } from "@/lib/handleEdgeFunctionError";
import type {
  EventDetection,
  EventDetectionFilter,
  EventDetectionStats,
} from "../types/EventDetection";

/**
 * Service layer for event detection data access
 * 
 * Handles:
 * - Fetching event detections for media assets
 * - Triggering event detection jobs
 * - Filtering and statistics
 */

interface GetEventDetectionsResponse {
  detections: EventDetection[];
  stats: EventDetectionStats;
  filters: Record<string, any>;
}

interface TriggerEventDetectionResponse {
  success: boolean;
  job_id: string;
  state: string;
  dispatched?: boolean;
  message_id?: string;
  dispatch_error?: string;
}

export const eventDetectionService = {
  /**
   * Get event detections for a media asset
   */
  async getEventDetections(
    mediaAssetId: string,
    filters?: EventDetectionFilter
  ): Promise<GetEventDetectionsResponse> {
    const params = new URLSearchParams({ media_id: mediaAssetId });

    if (filters?.event_types && filters.event_types.length > 0) {
      params.set("event_types", filters.event_types.join(","));
    }

    if (filters?.min_confidence !== undefined) {
      params.set("min_confidence", filters.min_confidence.toString());
    }

    if (filters?.verified_only) {
      params.set("verified_only", "true");
    }

    const { data, error } = await invokeEdge(`get-event-detections?${params.toString()}`, {
      method: "GET",
      orgScoped: true,
    });

    if (error) {
      throw await handleEdgeFunctionError(error);
    }

    return data as GetEventDetectionsResponse;
  },

  /**
   * Trigger event detection job for a media asset
   */
  async triggerEventDetection(
    mediaAssetId: string,
    autoDispatch = false
  ): Promise<TriggerEventDetectionResponse> {
    const { data, error } = await invokeEdge("trigger-event-detection", {
      method: "POST",
      body: {
        media_id: mediaAssetId,
        auto_dispatch: autoDispatch,
      },
      orgScoped: true,
    });

    if (error) {
      throw await handleEdgeFunctionError(error);
    }

    return data as TriggerEventDetectionResponse;
  },

  /**
   * Get event detection statistics for a media asset
   */
  async getEventStats(mediaAssetId: string): Promise<EventDetectionStats> {
    const response = await this.getEventDetections(mediaAssetId);
    return response.stats;
  },

  /**
   * Filter detections by type
   */
  filterByType(detections: EventDetection[], types: string[]): EventDetection[] {
    if (types.length === 0) return detections;
    return detections.filter((d) => types.includes(d.event_type));
  },

  /**
   * Filter detections by confidence threshold
   */
  filterByConfidence(detections: EventDetection[], minConfidence: number): EventDetection[] {
    return detections.filter((d) => d.confidence_score >= minConfidence);
  },

  /**
   * Group detections by event type
   */
  groupByType(detections: EventDetection[]): Record<string, EventDetection[]> {
    const grouped: Record<string, EventDetection[]> = {
      scrum: [],
      lineout: [],
      try: [],
      kick: [],
    };

    for (const detection of detections) {
      grouped[detection.event_type] ??= [];
      grouped[detection.event_type]!.push(detection);
    }

    return grouped;
  },
};

import { getAuthContext, getClientBoundToRequest } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getUserRoleFromRequest, requireRole } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

/**
 * Get event detections for a media asset
 * Returns auto-detected rugby events (scrums, lineouts, trys, kicks)
 */

interface QueryParams {
  media_id?: string;
  event_types?: string; // Comma-separated: "scrum,try"
  min_confidence?: string;
  verified_only?: string;
}

Deno.serve(withObservability("get-event-detections", async (req, ctx) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== "GET") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only GET is allowed", 405);
    }

    const supabase = getClientBoundToRequest(req);
    const { userId } = await getAuthContext(req);

    if (!userId) {
      return errorResponse("AUTH_INVALID_TOKEN", "Unauthorized", 401);
    }

    // Parse query parameters
    const url = new URL(req.url);
    const params: QueryParams = {
      media_id: url.searchParams.get("media_id") || undefined,
      event_types: url.searchParams.get("event_types") || undefined,
      min_confidence: url.searchParams.get("min_confidence") || undefined,
      verified_only: url.searchParams.get("verified_only") || undefined,
    };

    if (!params.media_id) {
      return errorResponse(
        "MISSING_REQUIRED_FIELDS",
        "Missing required parameter: media_id",
        400
      );
    }

    // Check if user has access to this media asset's org
    const { data: mediaAsset, error: mediaError } = await supabase
      .from("media_assets")
      .select("id, org_id")
      .eq("id", params.media_id)
      .single();

    if (mediaError || !mediaAsset) {
      return errorResponse("NOT_FOUND", "Media asset not found", 404);
    }

    try {
      const { role } = await getUserRoleFromRequest(req, {
        supabase,
        orgId: mediaAsset.org_id,
      });
      requireRole(role, "viewer");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Forbidden";
      return errorResponse("FORBIDDEN", message, 403);
    }

    // Build query
    let query = supabase
      .from("event_detections")
      .select("*")
      .eq("media_asset_id", params.media_id)
      .order("start_seconds", { ascending: true });

    // Apply filters
    if (params.event_types) {
      const types = params.event_types.split(",").map((t) => t.trim());
      query = query.in("event_type", types);
    }

    if (params.min_confidence) {
      const minConf = parseFloat(params.min_confidence);
      if (!isNaN(minConf)) {
        query = query.gte("confidence_score", minConf);
      }
    }

    if (params.verified_only === "true") {
      query = query.eq("verified", true);
    }

    const { data: detections, error: detectionsError } = await query;

    if (detectionsError) {
      return errorResponse(
        "QUERY_FAILED",
        `Failed to fetch event detections: ${detectionsError.message}`,
        500
      );
    }

    // Calculate statistics
    const stats = {
      total: detections.length,
      by_type: {
        scrum: 0,
        lineout: 0,
        try: 0,
        kick: 0,
      },
      avg_confidence: 0,
      verified_count: 0,
    };

    if (detections.length > 0) {
      let totalConfidence = 0;
      for (const detection of detections) {
        if (detection.event_type in stats.by_type) {
          (stats.by_type as any)[detection.event_type]++;
        }
        totalConfidence += detection.confidence_score;
        if (detection.verified) {
          stats.verified_count++;
        }
      }
      stats.avg_confidence = totalConfidence / detections.length;
    }

    return jsonResponse({
      detections,
      stats,
      filters: params,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

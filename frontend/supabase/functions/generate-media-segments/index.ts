import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

const SEGMENT_DURATION_SECONDS = 30;

serve(async (req) => {
  try {
    // Handle CORS preflight
    const cors = handleCors(req);
    if (cors) return cors;

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: {
            code: "METHOD_NOT_ALLOWED",
            message: "Only POST requests are allowed.",
          },
        }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract caller identity from JWT
    const { userId: callerId, isAdmin } = await getAuthContext(req);
    if (!callerId) {
      return new Response(
        JSON.stringify({
          error: {
            code: "AUTH_REQUIRED",
            message: "Authentication required.",
          },
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enforce admin-only access
    if (!isAdmin) {
      return new Response(
        JSON.stringify({
          error: {
            code: "FORBIDDEN",
            message: "Admin privileges required.",
          },
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate input
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_JSON",
            message: "Invalid JSON body.",
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { mediaAssetId } = body;

    if (!mediaAssetId || typeof mediaAssetId !== "string" || !mediaAssetId.trim()) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_REQUEST",
            message: "mediaAssetId is required and must be a non-empty string.",
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the media asset
    const { data: mediaAsset, error: fetchError } = await supabase
      .from("media_assets")
      .select("id, org_id, duration_seconds, streaming_ready")
      .eq("id", mediaAssetId.trim())
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching media asset:", fetchError);
      return new Response(
        JSON.stringify({
          error: {
            code: "FETCH_FAILED",
            message: "Failed to fetch media asset.",
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mediaAsset) {
      return new Response(
        JSON.stringify({
          error: {
            code: "NOT_FOUND",
            message: "Media asset not found.",
          },
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate streaming_ready
    if (!mediaAsset.streaming_ready) {
      return new Response(
        JSON.stringify({
          error: {
            code: "NOT_STREAMING_READY",
            message: "Media asset is not ready for streaming.",
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate duration
    if (!mediaAsset.duration_seconds || mediaAsset.duration_seconds <= 0) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_DURATION",
            message: "Media asset has invalid or zero duration.",
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if segments already exist
    const { data: existingSegments, error: segmentsCheckError } = await supabase
      .from("media_asset_segments")
      .select("id")
      .eq("media_asset_id", mediaAssetId.trim())
      .limit(1);

    if (segmentsCheckError) {
      console.error("Error checking existing segments:", segmentsCheckError);
      return new Response(
        JSON.stringify({
          error: {
            code: "SEGMENTS_CHECK_FAILED",
            message: "Failed to check existing segments.",
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If segments already exist, return skipped
    if (existingSegments && existingSegments.length > 0) {
      return new Response(
        JSON.stringify({
          status: "skipped",
          reason: "already_segmented",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate uniform segments
    const durationSeconds = mediaAsset.duration_seconds;
    const segments = [];
    let segmentIndex = 0;
    let currentStart = 0;

    while (currentStart < durationSeconds) {
      const end = Math.min(currentStart + SEGMENT_DURATION_SECONDS, durationSeconds);
      
      segments.push({
        media_asset_id: mediaAssetId.trim(),
        segment_index: segmentIndex,
        start_seconds: currentStart,
        end_seconds: end,
      });

      currentStart = end;
      segmentIndex++;
    }

    // Insert segments (use upsert for idempotency)
    const { error: insertError } = await supabase
      .from("media_asset_segments")
      .upsert(segments, {
        onConflict: "media_asset_id,segment_index",
        ignoreDuplicates: false,
      });

    if (insertError) {
      console.error("Error inserting segments:", insertError);
      return new Response(
        JSON.stringify({
          error: {
            code: "INSERT_FAILED",
            message: "Failed to insert segments.",
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return success
    return new Response(
      JSON.stringify({
        status: "created",
        count: segments.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error in generate-media-segments:", err);
    return new Response(
      JSON.stringify({
        error: {
          code: "UNEXPECTED_SERVER_ERROR",
          message: "An unexpected error occurred.",
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

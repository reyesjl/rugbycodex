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

    // Validate mediaAssetId if provided
    if (mediaAssetId !== undefined && mediaAssetId !== null) {
      if (typeof mediaAssetId !== "string" || !mediaAssetId.trim()) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INVALID_REQUEST",
              message: "mediaAssetId must be a non-empty string when provided.",
            },
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch media assets to process
    let mediaAssets: Array<{ id: string; duration_seconds: number; streaming_ready: boolean }>;
    
    if (mediaAssetId) {
      // Single asset mode
      const { data: mediaAsset, error: fetchError } = await supabase
        .from("media_assets")
        .select("id, duration_seconds, streaming_ready")
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

      mediaAssets = [mediaAsset];
    } else {
      // Batch mode - get all eligible assets
      const { data: allAssets, error: fetchError } = await supabase
        .from("media_assets")
        .select("id, duration_seconds, streaming_ready")
        .eq("streaming_ready", true)
        .gt("duration_seconds", 0);

      if (fetchError) {
        console.error("Error fetching media assets:", fetchError);
        return new Response(
          JSON.stringify({
            error: {
              code: "FETCH_FAILED",
              message: "Failed to fetch media assets.",
            },
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      mediaAssets = allAssets ?? [];
    }

    // Validate and filter assets
    const validAssets = mediaAssets.filter(asset => {
      return asset.streaming_ready && asset.duration_seconds > 0;
    });

    if (validAssets.length === 0) {
      return new Response(
        JSON.stringify({
          status: "skipped",
          reason: "no_eligible_assets",
          assets_processed: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process each asset
    let assetsProcessed = 0;
    let totalSegmentsCreated = 0;
    let assetsSkipped = 0;
    const errors: Array<{ asset_id: string; error: string }> = [];

    for (const asset of validAssets) {
      try {
        // Check if segments already exist
        const { data: existingSegments, error: segmentsCheckError } = await supabase
          .from("media_asset_segments")
          .select("id")
          .eq("media_asset_id", asset.id)
          .limit(1);

        if (segmentsCheckError) {
          errors.push({ asset_id: asset.id, error: "Failed to check existing segments" });
          continue;
        }

        // Skip if segments already exist
        if (existingSegments && existingSegments.length > 0) {
          assetsSkipped++;
          continue;
        }

        // Generate uniform segments
        const segments = [];
        let segmentIndex = 0;
        let currentStart = 0;

        while (currentStart < asset.duration_seconds) {
          const end = Math.min(currentStart + SEGMENT_DURATION_SECONDS, asset.duration_seconds);
          
          segments.push({
            media_asset_id: asset.id,
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
          errors.push({ asset_id: asset.id, error: "Failed to insert segments" });
          continue;
        }

        assetsProcessed++;
        totalSegmentsCreated += segments.length;
      } catch (err) {
        errors.push({ asset_id: asset.id, error: String(err) });
      }
    }

    // Return success with stats
    return new Response(
      JSON.stringify({
        status: "completed",
        assets_processed: assetsProcessed,
        assets_skipped: assetsSkipped,
        total_segments_created: totalSegmentsCreated,
        errors: errors.length > 0 ? errors : undefined,
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

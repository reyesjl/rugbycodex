import { getAuthContext, getClientBoundToRequest, getServiceRoleClient } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getUserRoleFromRequest, requireRole } from "../_shared/roles.ts";
import { logEvent, withObservability } from "../_shared/observability.ts";

/**
 * Trigger event detection job for a media asset
 * Creates a job record and optionally dispatches to SQS
 */

interface TriggerRequest {
  media_id: string;
  auto_dispatch?: boolean; // If true, automatically dispatch to SQS
}

Deno.serve(withObservability("trigger-event-detection", async (req, ctx) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed", 405);
    }

    const supabase = getClientBoundToRequest(req);
    const { userId } = await getAuthContext(req);

    if (!userId) {
      return errorResponse("AUTH_INVALID_TOKEN", "Unauthorized", 401);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_REQUEST_BODY", "Invalid JSON body", 400);
    }

    const { media_id, auto_dispatch = false } = body as TriggerRequest;

    if (!media_id) {
      return errorResponse(
        "MISSING_REQUIRED_FIELDS",
        "Missing required field: media_id",
        400
      );
    }

    // Check if user has access to this media asset's org
    const { data: mediaAsset, error: mediaError } = await supabase
      .from("media_assets")
      .select("id, org_id, streaming_ready, duration_seconds")
      .eq("id", media_id)
      .single();

    if (mediaError || !mediaAsset) {
      return errorResponse("NOT_FOUND", "Media asset not found", 404);
    }

    // Require staff role to trigger analysis
    try {
      const { role } = await getUserRoleFromRequest(req, {
        supabase,
        orgId: mediaAsset.org_id,
      });
      requireRole(role, "staff");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Forbidden";
      return errorResponse("FORBIDDEN", message, 403);
    }

    // Verify streaming_ready (transcoding must be complete)
    if (!mediaAsset.streaming_ready) {
      return errorResponse(
        "MEDIA_NOT_READY",
        "Media asset must be transcoded before event detection can run",
        400
      );
    }

    // Check for existing event detection job
    const serviceClient = getServiceRoleClient();
    const { data: existingJob } = await serviceClient
      .from("jobs")
      .select("id, state")
      .eq("media_asset_id", media_id)
      .eq("type", "event_detection")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJob && (existingJob.state === "queued" || existingJob.state === "running")) {
      return errorResponse(
        "JOB_ALREADY_EXISTS",
        `Event detection job already ${existingJob.state} for this media asset`,
        409
      );
    }

    // Create job record
    const { data: newJob, error: jobError } = await serviceClient
      .from("jobs")
      .insert({
        org_id: mediaAsset.org_id,
        media_asset_id: media_id,
        type: "event_detection",
        state: "queued",
        progress: 0,
        created_by: userId,
      })
      .select()
      .single();

    if (jobError || !newJob) {
      logEvent({
        severity: "error",
        event_type: "job_creation_failed",
        request_id: ctx.requestId,
        media_id,
        error: jobError?.message,
      });
      return errorResponse(
        "JOB_CREATION_FAILED",
        `Failed to create job: ${jobError?.message}`,
        500
      );
    }

    logEvent({
      severity: "info",
      event_type: "event_detection_job_created",
      request_id: ctx.requestId,
      job_id: newJob.id,
      media_id,
      org_id: mediaAsset.org_id,
    });

    const response: any = {
      success: true,
      job_id: newJob.id,
      state: newJob.state,
    };

    // Auto-dispatch to SQS if requested
    if (auto_dispatch) {
      try {
        const dispatchUrl = new URL(
          "/functions/v1/dispatch-job-to-sqs",
          Deno.env.get("SUPABASE_URL") || req.url
        );

        const dispatchResponse = await fetch(dispatchUrl.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": req.headers.get("Authorization") || "",
          },
          body: JSON.stringify({
            job_id: newJob.id,
            media_id,
            org_id: mediaAsset.org_id,
            type: "analysis",
          }),
        });

        if (dispatchResponse.ok) {
          const dispatchData = await dispatchResponse.json();
          response.dispatched = true;
          response.message_id = dispatchData.message_id;
          
          logEvent({
            severity: "info",
            event_type: "job_auto_dispatched",
            request_id: ctx.requestId,
            job_id: newJob.id,
            message_id: dispatchData.message_id,
          });
        } else {
          response.dispatched = false;
          response.dispatch_error = `Failed to dispatch: ${dispatchResponse.status}`;
          
          logEvent({
            severity: "warn",
            event_type: "auto_dispatch_failed",
            request_id: ctx.requestId,
            job_id: newJob.id,
            status: dispatchResponse.status,
          });
        }
      } catch (dispatchError) {
        response.dispatched = false;
        response.dispatch_error = dispatchError instanceof Error ? dispatchError.message : "Unknown error";
        
        logEvent({
          severity: "warn",
          event_type: "auto_dispatch_error",
          request_id: ctx.requestId,
          job_id: newJob.id,
          error: response.dispatch_error,
        });
      }
    }

    return jsonResponse(response);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

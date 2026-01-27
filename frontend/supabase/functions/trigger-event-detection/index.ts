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

interface SQSConfig {
  region: string;
  access_key: string;
  secret_key: string;
  analysis_queue_url: string;
}

function getSQSConfig(): SQSConfig {
  return {
    region: Deno.env.get("AWS_REGION") || "us-east-1",
    access_key: Deno.env.get("AWS_ACCESS_KEY_ID") || "",
    secret_key: Deno.env.get("AWS_SECRET_ACCESS_KEY") || "",
    analysis_queue_url: Deno.env.get("SQS_ANALYSIS_QUEUE_URL") || "",
  };
}

async function createSQSSignature(
  method: string,
  url: URL,
  body: string,
  config: SQSConfig
): Promise<Record<string, string>> {
  const crypto = globalThis.crypto.subtle;
  
  const date = new Date();
  const dateStamp = date.toISOString().split("T")[0].replace(/-/g, "");
  const amzDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, "");
  
  const service = "sqs";
  const region = config.region;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  
  const canonicalHeaders = [
    `host:${url.hostname}`,
    `x-amz-date:${amzDate}`,
  ].join("\n");
  
  const signedHeaders = "host;x-amz-date";
  
  const encoder = new TextEncoder();
  const bodyHash = Array.from(
    new Uint8Array(await crypto.digest("SHA-256", encoder.encode(body)))
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  
  const canonicalRequest = [
    method,
    url.pathname,
    url.search.slice(1),
    canonicalHeaders,
    "",
    signedHeaders,
    bodyHash,
  ].join("\n");
  
  const canonicalRequestHash = Array.from(
    new Uint8Array(await crypto.digest("SHA-256", encoder.encode(canonicalRequest)))
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");
  
  async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
    const cryptoKey = await crypto.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return new Uint8Array(await crypto.sign("HMAC", cryptoKey, encoder.encode(data)));
  }
  
  let signingKey = encoder.encode(`AWS4${config.secret_key}`);
  signingKey = await hmac(signingKey, dateStamp);
  signingKey = await hmac(signingKey, region);
  signingKey = await hmac(signingKey, service);
  signingKey = await hmac(signingKey, "aws4_request");
  
  const signature = Array.from(await hmac(signingKey, stringToSign))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${config.access_key}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");
  
  return {
    "host": url.hostname,
    "x-amz-date": amzDate,
    "authorization": authorization,
  };
}

async function sendToSQS(
  queueUrl: string,
  messageBody: Record<string, any>,
  config: SQSConfig,
  requestId: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const url = new URL(queueUrl);
    const body = new URLSearchParams({
      Action: "SendMessage",
      MessageBody: JSON.stringify(messageBody),
    }).toString();
    
    const headers = await createSQSSignature("POST", url, body, config);
    
    logEvent({
      severity: "info",
      event_type: "sqs_send_attempt",
      request_id: requestId,
      queue_url: queueUrl,
    });
    
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    
    if (!response.ok) {
      return { success: false, error: `SQS request failed: ${response.status}` };
    }
    
    const text = await response.text();
    const messageIdMatch = text.match(/<MessageId>([^<]+)<\/MessageId>/);
    const messageId = messageIdMatch ? messageIdMatch[1] : undefined;
    
    return { success: true, messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
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

    // Update processing_stage immediately for instant UI feedback
    const { error: stageUpdateError } = await serviceClient
      .from("media_assets")
      .update({ processing_stage: "detecting_events" })
      .eq("id", media_id);

    if (stageUpdateError) {
      logEvent({
        severity: "warn",
        event_type: "processing_stage_update_failed",
        request_id: ctx.requestId,
        media_id,
        error: stageUpdateError.message,
      });
      // Don't fail the request - worker will update it anyway
    } else {
      logEvent({
        severity: "info",
        event_type: "processing_stage_updated",
        request_id: ctx.requestId,
        media_id,
        stage: "detecting_events",
      });
    }

    const response: any = {
      success: true,
      job_id: newJob.id,
      state: newJob.state,
    };

    // Auto-dispatch to SQS if requested
    if (auto_dispatch) {
      const sqsConfig = getSQSConfig();
      
      if (!sqsConfig.access_key || !sqsConfig.secret_key) {
        logEvent({
          severity: "warn",
          event_type: "sqs_config_missing",
          request_id: ctx.requestId,
          job_id: newJob.id,
        });
        response.dispatched = false;
        response.dispatch_error = "AWS credentials not configured";
      } else if (!sqsConfig.analysis_queue_url) {
        logEvent({
          severity: "warn",
          event_type: "sqs_queue_url_missing",
          request_id: ctx.requestId,
          job_id: newJob.id,
        });
        response.dispatched = false;
        response.dispatch_error = "SQS analysis queue URL not configured";
      } else {
        const messageBody = {
          job_id: newJob.id,
          media_id,
          org_id: mediaAsset.org_id,
          type: "event_detection",
        };

        const sqsResult = await sendToSQS(
          sqsConfig.analysis_queue_url,
          messageBody,
          sqsConfig,
          ctx.requestId
        );

        if (sqsResult.success) {
          response.dispatched = true;
          response.message_id = sqsResult.messageId;
          
          logEvent({
            severity: "info",
            event_type: "job_dispatched",
            request_id: ctx.requestId,
            job_id: newJob.id,
            sqs_message_id: sqsResult.messageId,
          });
        } else {
          response.dispatched = false;
          response.dispatch_error = sqsResult.error;
          
          logEvent({
            severity: "warn",
            event_type: "sqs_dispatch_failed",
            request_id: ctx.requestId,
            job_id: newJob.id,
            error: sqsResult.error,
          });
        }
      }
    }

    return jsonResponse(response);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

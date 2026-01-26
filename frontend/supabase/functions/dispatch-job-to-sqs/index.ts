import { getAuthContext, getClientBoundToRequest, getServiceRoleClient } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getUserRoleFromRequest, requireRole } from "../_shared/roles.ts";
import { logEvent, withObservability } from "../_shared/observability.ts";

/**
 * Dispatch jobs to AWS SQS for GPU processing.
 */

interface DispatchRequest {
  job_id?: string; // Optional - will query if not provided
  media_id: string;
  org_id: string;
  type: "transcode" | "analysis";
}

interface SQSConfig {
  region: string;
  access_key: string;
  secret_key: string;
  transcode_queue_url: string;
  analysis_queue_url: string;
}

function getSQSConfig(): SQSConfig {
  return {
    region: Deno.env.get("AWS_REGION") || "us-east-1",
    access_key: Deno.env.get("AWS_ACCESS_KEY_ID") || "",
    secret_key: Deno.env.get("AWS_SECRET_ACCESS_KEY") || "",
    transcode_queue_url: Deno.env.get("SQS_TRANSCODE_QUEUE_URL") || "",
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
  
  let signingKey = await hmac(encoder.encode(`AWS4${config.secret_key}`), dateStamp);
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
    "Content-Type": "application/x-www-form-urlencoded",
    "X-Amz-Date": amzDate,
    "Authorization": authorization,
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
      Version: "2012-11-05",
    }).toString();
    
    const headers = await createSQSSignature("POST", url, body, config);
    
    const response = await fetch(queueUrl, {
      method: "POST",
      headers,
      body,
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      logEvent({
        severity: "error",
        event_type: "sqs_send_failed",
        request_id: requestId,
        status: response.status,
      });
      return { success: false, error: `SQS request failed: ${response.status}` };
    }
    
    const messageIdMatch = responseText.match(/<MessageId>([^<]+)<\/MessageId>/);
    const messageId = messageIdMatch ? messageIdMatch[1] : undefined;
    
    return { success: true, messageId };
    
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

Deno.serve(withObservability("dispatch-job-to-sqs", async (req, ctx) => {
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
    
    const { job_id, media_id, org_id, type } = body as DispatchRequest;
    
    if (!media_id || !org_id || !type) {
      return errorResponse(
        "MISSING_REQUIRED_FIELDS",
        "Missing required fields: media_id, org_id, type",
        400
      );
    }
    
    if (type !== "transcode" && type !== "analysis") {
      return errorResponse("INVALID_JOB_TYPE", "type must be 'transcode' or 'analysis'", 400);
    }
    
    try {
      const { role } = await getUserRoleFromRequest(req, { supabase, orgId: org_id });
      requireRole(role, "viewer");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Forbidden";
      return errorResponse("FORBIDDEN", message, 403);
    }
    
    // Query for job_id if not provided
    let actualJobId = job_id;
    
    if (!actualJobId) {
      logEvent({
        severity: "info",
        event_type: "querying_job_by_media_id",
        request_id: ctx.requestId,
        media_id,
        org_id,
        type,
      });
      
      // Use service role client to bypass RLS when querying jobs table
      const serviceClient = getServiceRoleClient();
      
      const { data: jobData, error: jobQueryError } = await serviceClient
        .from("jobs")
        .select("id, state, type")
        .eq("media_asset_id", media_id)
        .eq("type", type)
        .eq("state", "queued")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (jobQueryError) {
        logEvent({
          severity: "error",
          event_type: "job_query_failed",
          request_id: ctx.requestId,
          media_id,
          error: jobQueryError.message,
        });
        return errorResponse("JOB_QUERY_FAILED", `Failed to query job: ${jobQueryError.message}`, 500);
      }
      
      if (!jobData) {
        return errorResponse("JOB_NOT_FOUND", `No queued ${type} job found for media ${media_id}. The DB trigger may not have fired yet.`, 404);
      }
      
      actualJobId = jobData.id;
      logEvent({
        severity: "info",
        event_type: "job_found_by_media_id",
        request_id: ctx.requestId,
        media_id,
        job_id: actualJobId,
      });
    } else {
      // Validate provided job_id using service role
      const serviceClient = getServiceRoleClient();
      
      const { data: job, error: jobError } = await serviceClient
        .from("jobs")
        .select("id, state, type")
        .eq("id", job_id)
        .maybeSingle();
      
      if (jobError || !job) {
        return errorResponse("NOT_FOUND", "Job not found", 404);
      }
      
      if (job.type !== type) {
        return errorResponse("JOB_TYPE_MISMATCH", `Job type is '${job.type}', not '${type}'`, 400);
      }
    }
    
    const sqsConfig = getSQSConfig();
    if (!sqsConfig.access_key || !sqsConfig.secret_key) {
      return errorResponse("CONFIG_ERROR", "AWS credentials not configured", 500);
    }
    
    const queueUrl = type === "transcode" 
      ? sqsConfig.transcode_queue_url 
      : sqsConfig.analysis_queue_url;
    
    if (!queueUrl) {
      return errorResponse("CONFIG_ERROR", `SQS queue URL for ${type} not configured`, 500);
    }
    
    const messageBody = { job_id: actualJobId, media_id, org_id, type };
    const result = await sendToSQS(queueUrl, messageBody, sqsConfig, ctx.requestId);
    
    if (!result.success) {
      return errorResponse("SQS_SEND_FAILED", result.error || "Failed to send to SQS", 500);
    }
    
    logEvent({
      severity: "info",
      event_type: "job_dispatched",
      request_id: ctx.requestId,
      job_id: actualJobId,
      type,
      sqs_message_id: result.messageId,
    });
    
    return jsonResponse({
      success: true,
      job_id: actualJobId,
      message_id: result.messageId,
      queue: type,
    });
    
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

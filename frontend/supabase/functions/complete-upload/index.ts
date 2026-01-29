import { getAuthContext, getClientBoundToRequest, getServiceRoleClient } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getUserRoleFromRequest, requireAuthenticated, requireRole } from "../_shared/roles.ts";
import { logEvent, withObservability } from "../_shared/observability.ts";

interface CompleteUploadRequest {
  media_id: string;
  org_id: string;
  storage_path: string;
}

interface SQSConfig {
  region: string;
  access_key: string;
  secret_key: string;
  transcode_queue_url: string;
}

function getSQSConfig(): SQSConfig {
  return {
    region: Deno.env.get("AWS_REGION") || "us-east-1",
    access_key: Deno.env.get("AWS_ACCESS_KEY_ID") || "",
    secret_key: Deno.env.get("AWS_SECRET_ACCESS_KEY") || "",
    transcode_queue_url: Deno.env.get("SQS_TRANSCODE_QUEUE_URL") || "",
  };
}

async function createWasabiSignature(
  method: string,
  bucket: string,
  key: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<Record<string, string>> {
  const crypto = globalThis.crypto.subtle;
  const region = "us-east-1";
  const service = "s3";
  
  const date = new Date();
  const dateStamp = date.toISOString().split("T")[0].replace(/-/g, "");
  const amzDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, "");
  
  const host = `s3.wasabisys.com`;
  const canonicalUri = `/${bucket}/${key}`;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:UNSIGNED-PAYLOAD`,
    `x-amz-date:${amzDate}`,
  ].join("\n");
  
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    "",
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  
  const encoder = new TextEncoder();
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
  
  let signingKey = await hmac(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
  signingKey = await hmac(signingKey, region);
  signingKey = await hmac(signingKey, service);
  signingKey = await hmac(signingKey, "aws4_request");
  
  const signature = Array.from(await hmac(signingKey, stringToSign))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");
  
  return {
    "Host": host,
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD",
    "X-Amz-Date": amzDate,
    "Authorization": authorization,
  };
}

async function verifyFileExistsInWasabi(
  bucket: string,
  key: string,
  requestId: string,
  maxRetries: number = 3
): Promise<{ exists: boolean; error?: string }> {
  const accessKeyId = Deno.env.get("WASABI_UPLOADER_KEY");
  const secretAccessKey = Deno.env.get("WASABI_UPLOADER_SECRET");
  
  if (!accessKeyId || !secretAccessKey) {
    return { exists: false, error: "Wasabi credentials not configured" };
  }
  
  // Retry logic to handle S3 eventual consistency
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logEvent({
        severity: "info",
        event_type: "wasabi_verification_start",
        request_id: requestId,
        bucket,
        key,
        attempt,
        max_retries: maxRetries,
      });
      
      const headers = await createWasabiSignature("HEAD", bucket, key, accessKeyId, secretAccessKey);
      const url = `https://s3.wasabisys.com/${bucket}/${key}`;
      
      const response = await fetch(url, {
        method: "HEAD",
        headers,
      });
      
      logEvent({
        severity: "info",
        event_type: "wasabi_verification_complete",
        request_id: requestId,
        bucket,
        key,
        status: response.status,
        exists: response.ok,
        attempt,
      });
      
      if (response.ok) {
        return { exists: true };
      }
      
      // If not the last attempt and got 404, retry with exponential backoff
      if (attempt < maxRetries && response.status === 404) {
        const delayMs = 1000 * Math.pow(2, attempt); // 2s, 4s, 8s
        logEvent({
          severity: "info",
          event_type: "wasabi_verification_retry",
          request_id: requestId,
          bucket,
          key,
          attempt,
          delay_ms: delayMs,
          reason: "eventual_consistency",
        });
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // Non-404 error or last attempt failed
      return { exists: false, error: `File not found in storage (status: ${response.status})` };
      
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      
      // If not the last attempt, retry
      if (attempt < maxRetries) {
        const delayMs = 1000 * Math.pow(2, attempt);
        logEvent({
          severity: "warn",
          event_type: "wasabi_verification_error_retry",
          request_id: requestId,
          bucket,
          key,
          attempt,
          delay_ms: delayMs,
          error_message: message,
        });
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // Last attempt failed
      logEvent({
        severity: "error",
        event_type: "wasabi_verification_failed",
        request_id: requestId,
        bucket,
        key,
        error_message: message,
        attempts: maxRetries,
      });
      return { exists: false, error: message };
    }
  }
  
  return { exists: false, error: "File not found after all retries" };
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

Deno.serve(withObservability("complete-upload", async (req, ctx) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  
  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed", 405);
    }
    
    const supabase = getClientBoundToRequest(req);
    const { userId } = await getAuthContext(req);
    
    try {
      requireAuthenticated(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unauthorized";
      return errorResponse("AUTH_REQUIRED", message, 401);
    }
    
    const body = await req.json().catch(() => null);
    if (!body) {
      return errorResponse("INVALID_REQUEST_BODY", "Invalid JSON body", 400);
    }
    
    const { media_id, org_id, storage_path } = body as CompleteUploadRequest;
    
    if (!media_id || !org_id || !storage_path) {
      return errorResponse(
        "MISSING_REQUIRED_FIELDS",
        "Missing required fields: media_id, org_id, storage_path",
        400
      );
    }
    
    // Verify user has access to the organization
    try {
      const { role } = await getUserRoleFromRequest(req, { supabase, orgId: org_id });
      requireRole(role, "member");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Forbidden";
      return errorResponse("FORBIDDEN", message, 403);
    }
    
    logEvent({
      severity: "info",
      event_type: "upload_completion_start",
      request_id: ctx.requestId,
      user_id: userId,
      org_id,
      media_id,
    });
    
    // Step 1: Verify file exists in Wasabi
    const bucket = "rugbycodex";
    const verification = await verifyFileExistsInWasabi(bucket, storage_path, ctx.requestId);
    
    if (!verification.exists) {
      return errorResponse(
        "UPLOAD_VERIFICATION_FAILED",
        verification.error || "File not found in storage",
        400
      );
    }
    
    // Use service role client for all database operations
    const serviceClient = getServiceRoleClient();
    
    // Step 2: Update media_assets to "uploaded" status
    logEvent({
      severity: "info",
      event_type: "updating_media_status_uploaded",
      request_id: ctx.requestId,
      media_id,
    });
    
    const { error: uploadedError } = await serviceClient
      .from("media_assets")
      .update({
        status: "uploaded",
        storage_path,
      })
      .eq("id", media_id)
      .eq("org_id", org_id);
    
    if (uploadedError) {
      logEvent({
        severity: "error",
        event_type: "media_update_failed",
        request_id: ctx.requestId,
        media_id,
        error_message: uploadedError.message,
      });
      return errorResponse("MEDIA_UPDATE_FAILED", `Failed to update media status: ${uploadedError.message}`, 500);
    }
    
    // Step 3: Get or create job (idempotent)
    let { data: job } = await serviceClient
      .from("jobs")
      .select("id, state")
      .eq("media_asset_id", media_id)
      .eq("type", "transcode")
      .maybeSingle();
    
    if (!job) {
      logEvent({
        severity: "info",
        event_type: "creating_transcode_job",
        request_id: ctx.requestId,
        media_id,
        org_id,
      });
      
      const { data: newJob, error: jobError } = await serviceClient
        .from("jobs")
        .insert({
          media_asset_id: media_id,
          org_id,
          type: "transcode",
          state: "queued",
        })
        .select("id, state")
        .single();
      
      if (jobError) {
        logEvent({
          severity: "error",
          event_type: "job_create_failed",
          request_id: ctx.requestId,
          media_id,
          error_message: jobError.message,
        });
        return errorResponse("JOB_CREATE_FAILED", `Failed to create job: ${jobError.message}`, 500);
      }
      
      job = newJob;
      
      logEvent({
        severity: "info",
        event_type: "job_created",
        request_id: ctx.requestId,
        job_id: job.id,
        media_id,
      });
    } else {
      logEvent({
        severity: "info",
        event_type: "job_already_exists",
        request_id: ctx.requestId,
        job_id: job.id,
        media_id,
      });
    }
    
    // Step 4: Dispatch to SQS
    const sqsConfig = getSQSConfig();
    if (!sqsConfig.access_key || !sqsConfig.secret_key) {
      return errorResponse("CONFIG_ERROR", "AWS credentials not configured", 500);
    }
    
    if (!sqsConfig.transcode_queue_url) {
      return errorResponse("CONFIG_ERROR", "SQS transcode queue URL not configured", 500);
    }
    
    const messageBody = {
      job_id: job.id,
      media_id,
      org_id,
      type: "transcode",
    };
    
    const sqsResult = await sendToSQS(
      sqsConfig.transcode_queue_url,
      messageBody,
      sqsConfig,
      ctx.requestId
    );
    
    if (!sqsResult.success) {
      return errorResponse("SQS_SEND_FAILED", sqsResult.error || "Failed to send to SQS", 500);
    }
    
    logEvent({
      severity: "info",
      event_type: "job_dispatched",
      request_id: ctx.requestId,
      job_id: job.id,
      sqs_message_id: sqsResult.messageId,
    });
    
    // Step 5: Update media_assets to "ready" status
    logEvent({
      severity: "info",
      event_type: "updating_media_status_ready",
      request_id: ctx.requestId,
      media_id,
    });
    
    const { error: readyError } = await serviceClient
      .from("media_assets")
      .update({ status: "ready" })
      .eq("id", media_id)
      .eq("org_id", org_id);
    
    if (readyError) {
      logEvent({
        severity: "warn",
        event_type: "media_ready_update_failed",
        request_id: ctx.requestId,
        media_id,
        error_message: readyError.message,
      });
      // Don't fail the request - job is already dispatched
    }
    
    logEvent({
      severity: "info",
      event_type: "upload_completion_success",
      request_id: ctx.requestId,
      user_id: userId,
      org_id,
      media_id,
      job_id: job.id,
    });
    
    return jsonResponse({
      success: true,
      media_id,
      job_id: job.id,
      message_id: sqsResult.messageId,
    });
    
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    logEvent({
      severity: "error",
      event_type: "unexpected_error",
      request_id: ctx.requestId,
      error_message: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

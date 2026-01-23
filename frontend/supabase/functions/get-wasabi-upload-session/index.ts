import { GetSessionTokenCommand, STSClient } from "npm:@aws-sdk/client-sts";
import { getAuthContext, getClientBoundToRequest } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import {
  allowAdminBypass,
  getUserRoleFromRequest,
  requireAuthenticated,
  requireOrgRoleSource,
  requireRole,
} from "../_shared/roles.ts";
import { insertMediaAsset } from "../_shared/media.ts";
import { logEvent, withObservability } from "../_shared/observability.ts";

Deno.serve(withObservability("get-wasabi-upload-session", async (req, ctx) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }

    console.warn("AUTH CLIENT DEBUG", {
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });

    const supabase = getClientBoundToRequest(req);
    const { userId, isAdmin } = await getAuthContext(req);

    try {
      requireAuthenticated(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unauthorized";
      return errorResponse("AUTH_REQUIRED", message, 401);
    }

    const { org_id, bucket, file_name, duration_seconds } = await req.json();
    if (!org_id || !bucket || !file_name || !duration_seconds) {
      return errorResponse("MISSING_REQUIRED_FIELDS", "org_id, bucket, file_name, and duration_seconds are required", 400);
    }

    if (bucket !== "rugbycodex") {
      return errorResponse("INVALID_BUCKET", `Invalid bucket "${bucket}". Only "rugbycodex" is allowed.`, 400);
    }

    // Verify org membership unless admin
    let enforceRole = false;
    allowAdminBypass(isAdmin, () => {
      enforceRole = true;
    });

    if (enforceRole) {
      try {
        const { userId: orgUserId, role, source } = await getUserRoleFromRequest(req, { supabase, orgId: org_id });
        requireAuthenticated(orgUserId);
        requireOrgRoleSource(source);
        requireRole(role, "member");
      } catch (err) {
        logEvent({
          severity: "warn",
          event_type: "permission_denied",
          request_id: ctx.requestId,
          function: "get-wasabi-upload-session",
          org_id,
          user_id: userId,
          error_code: "FORBIDDEN",
          error_message: "User is not authorized for org upload",
        });
        const message = err instanceof Error ? err.message : "You must be a member of the Org to Upload Media";
        return errorResponse("FORBIDDEN", message, 403);
      }
    }

    // The base storage path to protect duplicate upload files within the org
    const base_storage_path = `orgs/${org_id}/uploads/`;

    // Insert initial row
    let newAsset;
    try {
      newAsset = await insertMediaAsset({
        org_id,
        uploader_id: userId,
        file_name,
        status: "uploading",
        duration_seconds,
        base_org_storage_path: base_storage_path,
      }, supabase, ctx.requestId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create media asset record";
      console.error("Media asset creation failed:", err);
      return errorResponse("MEDIA_ASSET_CREATE_FAILED", message, 500);
    }

    const mediaId = newAsset.id;

    // Generate temporary AWS credentials using STS
    // Use the scoped uploader IAM user credentials (arn:aws:iam:XXXX:user/rugbycodex-uploader)
    const region = "us-east-1";
    const endpoint = "https://sts.wasabisys.com";
    const accessKeyId = Deno.env.get("WASABI_UPLOADER_KEY");
    const secretAccessKey = Deno.env.get("WASABI_UPLOADER_SECRET");

    if (!accessKeyId || !secretAccessKey) {
      console.error("Wasabi credentials not configured");
      return errorResponse("WASABI_CREDENTIALS_MISSING", "Uploader credentials not configured", 500);
    }

    const stsClient = new STSClient({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });

    // Build the final storage path
    // orgs/<org_id>/uploads/<media_id>/raw/<file_name>
    const storage_path = `orgs/${org_id}/uploads/${mediaId}/raw/${file_name}`;

    // Get temporary session credentials
    const getSessionTokenCommand = new GetSessionTokenCommand({
      DurationSeconds: 3600, // 1 hour
    });

    const stsStart = performance.now();
    let sessionResponse;
    try {
      sessionResponse = await stsClient.send(getSessionTokenCommand);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to obtain STS credentials";
      console.error("Wasabi STS call failed:", err);
      logEvent({
        severity: "error",
        event_type: "metric",
        metric_name: "api_external_call_errors_total",
        metric_value: 1,
        tags: { service: "wasabi_sts", function: "get-wasabi-upload-session" },
      });
      return errorResponse("WASABI_STS_FAILED", message, 500);
    }

    const stsDuration = Math.round(performance.now() - stsStart);
    logEvent({
      severity: "info",
      event_type: "metric",
      metric_name: "api_external_call_latency_ms",
      metric_value: stsDuration,
      tags: { service: "wasabi_sts", function: "get-wasabi-upload-session" },
    });

    const credentials = sessionResponse.Credentials;

    if (!credentials) {
      console.error("No credentials returned from STS");
      return errorResponse("WASABI_STS_FAILED", "Failed to obtain temporary credentials", 500);
    }

    logEvent({
      severity: "info",
      event_type: "upload_session_created",
      request_id: ctx.requestId,
      org_id,
      user_id: userId,
      media_id: mediaId,
    });

    return new Response(JSON.stringify({
      credentials: {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
        expiresAt: credentials.Expiration?.toISOString(),
      },
      storage_path,
      media_id: mediaId,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Unexpected error in get-wasabi-upload-session:", err);
    logEvent({
      severity: "error",
      event_type: "request_error",
      request_id: ctx.requestId,
      function: "get-wasabi-upload-session",
      error_code: "UNEXPECTED_SERVER_ERROR",
      error_message: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return errorResponse("UNEXPECTED_SERVER_ERROR", "An unexpected error occurred", 500);
  }
}));

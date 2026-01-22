import { GetSessionTokenCommand, STSClient } from "npm:@aws-sdk/client-sts";
import { getAuthContext, getClientBoundToRequest } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { isOrgMember } from "../_shared/orgs.ts";
import { insertMediaAsset } from "../_shared/media.ts";
import { logEvent, withObservability } from "../_shared/observability.ts";

Deno.serve(withObservability("get-wasabi-upload-session", async (req, ctx) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method Not Allowed" }, 405);
    }
    const supabase = getClientBoundToRequest(req);
    const { userId, isAdmin } = await getAuthContext(req);
    if (!userId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { org_id, bucket, file_name, duration_seconds } = await req.json();
    if (!org_id || !bucket || !file_name || !duration_seconds) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    if (bucket !== "rugbycodex") {
      return jsonResponse({ error: "Invalid bucket" }, 400);
    }

    // Verify org membership unless admin
    if (!isAdmin) {
      const isMember = await isOrgMember(org_id, userId, supabase, ctx.requestId);
      if (!isMember) {
        logEvent({
          severity: "warn",
          event_type: "permission_denied",
          request_id: ctx.requestId,
          function: "get-wasabi-upload-session",
          org_id,
          user_id: userId,
          error_code: "AUTH_PERMISSION_DENIED",
          error_message: "User is not a member of organization",
        });
        return jsonResponse({ error: "You must be a member of the Org to Upload Media" }, 403);
      }
    }

    // The base storage path to protect duplicate upload files within the org
    const base_storage_path = `orgs/${org_id}/uploads/`;
    // Insert initial row
    const newAsset = await insertMediaAsset({
      org_id,
      uploader_id: userId,
      file_name,
      status: "uploading",
      duration_seconds,
      base_org_storage_path: base_storage_path,
    }, supabase, ctx.requestId);

    const mediaId = newAsset.id;

    // Generate temporary AWS credentials using STS
    // Use the scoped uploader IAM user credentials (arn:aws:iam:XXXX:user/rugbycodex-uploader)
    const region = "us-east-1";
    const endpoint = "https://sts.wasabisys.com";
    const accessKeyId = Deno.env.get("WASABI_UPLOADER_KEY");
    const secretAccessKey = Deno.env.get("WASABI_UPLOADER_SECRET");

    if (!accessKeyId || !secretAccessKey) {
      return jsonResponse({ error: "Uploader credentials not configured" }, 500);
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
    const sessionResponse = await stsClient.send(getSessionTokenCommand);
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
      return jsonResponse({ error: "Failed to obtain temporary credentials" }, 500);
    }

    logEvent({
      severity: "info",
      event_type: "upload_session_created",
      request_id: ctx.requestId,
      org_id,
      user_id: userId,
      media_id: mediaId,
    });

    return jsonResponse({
      credentials: {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
        expiresAt: credentials.Expiration?.toISOString(),
      },
      storage_path,
      media_id: mediaId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent({
      severity: "error",
      event_type: "request_error",
      request_id: ctx.requestId,
      function: "get-wasabi-upload-session",
      error_code: "WASABI_UPLOAD_FAILED",
      error_message: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    logEvent({
      severity: "error",
      event_type: "metric",
      metric_name: "api_external_call_errors_total",
      metric_value: 1,
      tags: { service: "wasabi_sts", function: "get-wasabi-upload-session" },
    });
    return jsonResponse({ error: `${err}` }, 500);
  }
}));

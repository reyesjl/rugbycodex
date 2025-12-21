import { GetSessionTokenCommand, STSClient } from "npm:@aws-sdk/client-sts";
import { getAuthContext, getClientBoundToRequest } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { isOrgMember } from "../_shared/orgs.ts";
import { insertMediaAsset } from "../_shared/media.ts";

Deno.serve(async (req) => {
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

    const { org_id, bucket, file_name } = await req.json();
    if (!org_id || !bucket || !file_name) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    if (bucket !== "rugbycodex") {
      return jsonResponse({ error: "Invalid bucket" }, 400);
    }

    // Verify org membership unless admin
    if (!isAdmin) {
      const isMember = await isOrgMember(userId, org_id, supabase);
      if (!isMember) {
        return jsonResponse({ error: "You must be a member of the Org to Upload Media" }, 403);
      }
    }

    // Insert initial row
    const newAsset = await insertMediaAsset({
      org_id,
      uploader_id: userId,
      file_name,
      status: "uploading",
    }, supabase);

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

    const sessionResponse = await stsClient.send(getSessionTokenCommand);
    const credentials = sessionResponse.Credentials;

    if (!credentials) {
      return jsonResponse({ error: "Failed to obtain temporary credentials" }, 500);
    }

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
    console.error("Error in get-wasabi-upload-session:", err);
    return jsonResponse({ error: `${err}` }, 500);
  }
});

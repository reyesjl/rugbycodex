import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getAuthContext } from "../_shared/auth.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

Deno.serve(withObservability("get-organizations-near-limit", async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }

    const { userId, isAdmin } = await getAuthContext(req);
    try {
      requireAuthenticated(userId);
      requirePlatformAdmin(isAdmin);
    } catch (err) {
      const status = (err as any)?.status ?? 403;
      const message = err instanceof Error ? err.message : (status === 401 ? "Unauthorized" : "Forbidden");
      return errorResponse(status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN", message, status);
    }

    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    const computedAt = new Date().toISOString();

    // Load organizations
    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("id, owner, slug, name, created_at, storage_limit_mb, bio, visibility, type");

    if (orgError || !organizations) {
      console.error("Failed to load organizations:", orgError);
      return errorResponse("DB_QUERY_FAILED", "Failed to load organizations", 500);
    }

    // Load aggregated storage usage per org
    const { data: assets, error: assetsError } = await supabase
      .from("media_assets")
      .select("org_id, file_size_bytes");

    if (assetsError) {
      console.error("Failed to load media assets:", assetsError);
      return errorResponse("DB_QUERY_FAILED", "Failed to load storage usage", 500);
    }

    // Aggregate used bytes by org_id
    const usageByOrg: Record<string, number> = {};
    for (const asset of assets ?? []) {
      const orgId = asset.org_id;
      usageByOrg[orgId] = (usageByOrg[orgId] ?? 0) + Number(asset.file_size_bytes ?? 0);
    }

    const WARNING_THRESHOLD = 0.75;

    // Build response
    const results = organizations.map((org) => {
      const usedBytes = usageByOrg[org.id] ?? 0;
      const limitMb = org.storage_limit_mb;
      const limitBytes = limitMb * 1024 * 1024;

      if (limitBytes === 0) return null;

      const utilizationRatio = usedBytes / limitBytes;
      if (utilizationRatio < WARNING_THRESHOLD) return null;

      return {
        organization: org,
        used_bytes: usedBytes,
        limit_mb: limitMb,
        utilization_ratio: utilizationRatio,
        computed_at: computedAt
      };
    }).filter(Boolean);

    return jsonResponse(results, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in get-organizations-near-limit:", err);
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

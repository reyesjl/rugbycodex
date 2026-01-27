import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getAuthContext } from "../_shared/auth.ts";
import {
  allowAdminBypass,
  getUserRoleFromRequest,
  requireAuthenticated,
  requireOrgRoleSource,
  requireRole,
} from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

Deno.serve(withObservability("get-organization-stats", async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }

    console.warn("AUTH CLIENT DEBUG", {
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });

    const { userId, isAdmin } = await getAuthContext(req);
    try {
      requireAuthenticated(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unauthorized";
      return errorResponse("AUTH_REQUIRED", message, 401);
    }

    const { orgId } = await req.json();
    if (!orgId) {
      return errorResponse("MISSING_REQUIRED_FIELDS", "orgId is required", 400);
    }

    let enforceRole = false;
    allowAdminBypass(isAdmin, () => {
      enforceRole = true;
    });

    if (enforceRole) {
      try {
        const { userId: orgUserId, role, source } = await getUserRoleFromRequest(req, { orgId });
        requireAuthenticated(orgUserId);
        requireOrgRoleSource(source);
        requireRole(role, "manager");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Forbidden";
        return errorResponse("FORBIDDEN", message, 403);
      }
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

    // Member count
    const { count: memberCount } = await supabase
      .from("org_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId);

    // Media assets: count + storage
    const { data: assets } = await supabase
      .from("media_assets")
      .select("file_size_bytes")
      .eq("org_id", orgId);

    const totalStorageBytes = assets?.reduce((sum, row) => sum + Number(row.file_size_bytes), 0) ?? 0;
    const mediaAssetCount = assets?.length ?? 0;

    // Last upload
    const { data: lastUpload } = await supabase
      .from("media_assets")
      .select("created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastUploadAt = lastUpload?.created_at ?? null;

    // Jobs: count + last job
    const { count: jobsCount } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId);

    const { data: lastJob } = await supabase
      .from("jobs")
      .select("created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastJobAt = lastJob?.created_at ?? null;

    return jsonResponse({
      org_id: orgId,
      member_count: memberCount ?? 0,
      media_asset_count: mediaAssetCount,
      total_storage_bytes: totalStorageBytes,
      jobs_count: jobsCount ?? 0,
      last_upload_at: lastUploadAt,
      last_job_at: lastJobAt,
      computed_at: computedAt
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in get-organization-stats:", err);
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getAuthContext } from "../_shared/auth.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

const INACTIVITY_DAYS = 30;
const DEFAULT_LIMIT = 50;

Deno.serve(withObservability("get-inactive-organizations", async (req) => {
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

    const cutoffDate = new Date(Date.now() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Load candidate organizations (older than cutoff)
    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("id, owner, slug, name, created_at, storage_limit_mb, bio, visibility, type")
      .lt("created_at", cutoffDate)
      .order("created_at", { ascending: true })
      .limit(DEFAULT_LIMIT);

    if (orgError || !organizations) {
      console.error("Failed to load organizations:", orgError);
      return errorResponse("DB_QUERY_FAILED", "Failed to load organizations", 500);
    }

    if (organizations.length === 0) {
      return jsonResponse([], 200);
    }

    const orgIds = organizations.map((o) => o.id);

    // Last upload per org
    const { data: uploads } = await supabase
      .from("media_assets")
      .select("org_id, created_at")
      .in("org_id", orgIds);

    const lastUploadByOrg: Record<string, string> = {};
    for (const row of uploads ?? []) {
      const prev = lastUploadByOrg[row.org_id];
      if (!prev || new Date(row.created_at) > new Date(prev)) {
        lastUploadByOrg[row.org_id] = row.created_at;
      }
    }

    // Last job per org
    const { data: jobs } = await supabase
      .from("jobs")
      .select("org_id, created_at")
      .in("org_id", orgIds);

    const lastJobByOrg: Record<string, string> = {};
    for (const row of jobs ?? []) {
      const prev = lastJobByOrg[row.org_id];
      if (!prev || new Date(row.created_at) > new Date(prev)) {
        lastJobByOrg[row.org_id] = row.created_at;
      }
    }

    // Member counts
    const { data: members } = await supabase
      .from("org_members")
      .select("org_id");

    const memberCountByOrg: Record<string, number> = {};
    for (const row of members ?? []) {
      memberCountByOrg[row.org_id] = (memberCountByOrg[row.org_id] ?? 0) + 1;
    }

    // Apply inactivity heuristic
    const inactiveOrgs = organizations.filter((org) => {
      const lastUpload = lastUploadByOrg[org.id];
      const lastJob = lastJobByOrg[org.id];
      const uploadInactive = !lastUpload || new Date(lastUpload) < new Date(cutoffDate);
      const jobInactive = !lastJob || new Date(lastJob) < new Date(cutoffDate);
      return uploadInactive && jobInactive;
    });

    // Shape response
    const result = inactiveOrgs.map((org) => ({
      organization: org,
      member_count: memberCountByOrg[org.id] ?? 0,
      last_activity_at: lastUploadByOrg[org.id] ?? lastJobByOrg[org.id] ?? null,
      health_status: "unknown"
    }));

    return jsonResponse(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in get-inactive-organizations:", err);
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

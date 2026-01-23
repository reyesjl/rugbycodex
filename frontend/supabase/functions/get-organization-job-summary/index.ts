import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

serve(withObservability("get-organization-job-summary", async (req) => {
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

    const { data: recentJobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, org_id, type, state, progress, error_code, error_message, created_by, created_at, started_at, finished_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (jobsError) {
      console.error("Failed to fetch jobs:", jobsError);
      return errorResponse("DB_QUERY_FAILED", "Failed to fetch jobs", 500);
    }

    const byState: Record<string, number> = {};
    for (const job of recentJobs ?? []) {
      byState[job.state] = (byState[job.state] ?? 0) + 1;
    }
    const total = recentJobs?.length ?? 0;

    return jsonResponse({
      org_id: orgId,
      total,
      by_state: byState,
      recent: recentJobs ?? [],
      computed_at: computedAt
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in get-organization-job-summary:", err);
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

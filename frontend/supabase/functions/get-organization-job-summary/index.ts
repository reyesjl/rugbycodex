import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import {
  allowAdminBypass,
  getUserRoleFromRequest,
  requireAuthenticated,
  requireOrgRoleSource,
  requireRole,
} from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";
serve(withObservability("get-organization-job-summary", async (req)=>{
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }
    const { userId, isAdmin } = await getAuthContext(req);
    try {
      requireAuthenticated(userId);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    const { orgId } = await req.json();
    if (!orgId) {
      return new Response("orgId is required", {
        status: 400
      });
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
      } catch {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const computedAt = new Date().toISOString();
    // Fetch recent jobs (DB-ordered)
    const { data: recentJobs, error: jobsError } = await supabase.from("jobs").select("id, org_id, type, state, progress, error_code, error_message, created_by, created_at, started_at, finished_at").eq("org_id", orgId).order("created_at", {
      ascending: false
    }).limit(10);
    if (jobsError) {
      console.error(jobsError);
      return new Response("Failed to fetch jobs", {
        status: 500
      });
    }
    // Aggregate counts by state
    const byState = {};
    for (const job of recentJobs ?? []){
      byState[job.state] = (byState[job.state] ?? 0) + 1;
    }
    const total = recentJobs?.length ?? 0;
    // Response — OrgJobSummary (exact contract)
    return new Response(JSON.stringify({
      org_id: orgId,
      total,
      by_state: byState,
      recent: recentJobs ?? [],
      computed_at: computedAt
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error(err);
    return new Response("Internal Server Error", {
      status: 500
    });
  }
}));

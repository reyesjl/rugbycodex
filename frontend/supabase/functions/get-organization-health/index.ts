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

serve(withObservability("get-organization-health", async (req) => {
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

    // Load organization
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id, storage_limit_mb")
      .eq("id", orgId)
      .single();

    if (orgError || !organization) {
      console.error("Organization not found:", orgError);
      return errorResponse("NOT_FOUND", "Organization not found", 404);
    }
    // ------------------------------------------------------------------
    // STORAGE SIGNAL
    // ------------------------------------------------------------------
    const { data: assets } = await supabase.from("media_assets").select("file_size_bytes").eq("org_id", orgId);
    const usedBytes = assets?.reduce((sum, a)=>sum + Number(a.file_size_bytes), 0) ?? 0;
    const limitMb = organization.storage_limit_mb;
    const limitBytes = limitMb * 1024 * 1024;
    const utilization = limitBytes > 0 ? usedBytes / limitBytes : 0;
    const STORAGE_WARNING_THRESHOLD = 0.75;
    const STORAGE_CRITICAL_THRESHOLD = 0.9;
    const storageSignal = {
      used_bytes: usedBytes,
      limit_mb: limitMb,
      near_limit: utilization >= STORAGE_WARNING_THRESHOLD
    };
    // ------------------------------------------------------------------
    // JOB SIGNAL
    // ------------------------------------------------------------------
    const { data: jobs } = await supabase.from("jobs").select("state, created_at").eq("org_id", orgId).order("created_at", {
      ascending: false
    }).limit(10);
    let failingRecently = false;
    let lastErrorAt = null;
    if (jobs && jobs.length > 0) {
      const failedJobs = jobs.filter((j)=>j.state === "failed");
      failingRecently = failedJobs.length >= 3 || failedJobs.length / jobs.length >= 0.5;
      if (failedJobs.length > 0) {
        lastErrorAt = failedJobs[0].created_at;
      }
    }
    const jobsSignal = jobs && jobs.length > 0 ? {
      failing_recently: failingRecently,
      last_error_at: lastErrorAt
    } : undefined;
    // ------------------------------------------------------------------
    // ACTIVITY SIGNAL
    // ------------------------------------------------------------------
    const lastUploadAt = assets && assets.length > 0 ? (await supabase.from("media_assets").select("created_at").eq("org_id", orgId).order("created_at", {
      ascending: false
    }).limit(1).single()).data?.created_at ?? null : null;
    const lastJobAt = jobs && jobs.length > 0 ? jobs[0].created_at : null;
    const activitySignal = {
      last_upload_at: lastUploadAt,
      last_job_at: lastJobAt
    };
    // ------------------------------------------------------------------
    // FINAL STATUS DETERMINATION
    // ------------------------------------------------------------------
    let status = "healthy";
    if (limitBytes === 0) {
      status = "unknown";
    }
    if (utilization >= STORAGE_CRITICAL_THRESHOLD) {
      status = "critical";
    } else if (utilization >= STORAGE_WARNING_THRESHOLD) {
      status = "warning";
    }
    if (failingRecently) {
      status = status === "critical" ? "critical" : "warning";
    }
    const INACTIVITY_WARNING_DAYS = 60;
    if (lastUploadAt) {
      const daysSinceUpload = (Date.now() - new Date(lastUploadAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpload >= INACTIVITY_WARNING_DAYS) {
        status = status === "healthy" ? "warning" : status;
      }
    }
    // RESPONSE
    return jsonResponse({
      org_id: orgId,
      status,
      signals: {
        storage: storageSignal,
        jobs: jobsSignal,
        activity: activitySignal
      },
      computed_at: computedAt
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in get-organization-health:", err);
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

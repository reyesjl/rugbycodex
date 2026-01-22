import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEvent, withObservability } from "../_shared/observability.ts";
import { allowAdminBypass, getUserRoleFromRequest, requireAuthenticated, requireOrgRoleSource, requireRole } from "../_shared/roles.ts";
serve(withObservability("upload-eligibility-check", async (req, ctx)=>{
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }
    const { orgId, fileSizeBytes } = await req.json();
    if (!orgId || !fileSizeBytes || fileSizeBytes <= 0) {
      return new Response("Invalid input", {
        status: 400
      });
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logEvent({
        severity: "warn",
        event_type: "auth_failure",
        request_id: ctx.requestId,
        function: "upload-eligibility-check",
        error_code: "AUTH_INVALID_TOKEN",
        error_message: "Missing Authorization header",
      });
      return new Response("Missing Authorization header", {
        status: 401
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // Identify caller
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      logEvent({
        severity: "warn",
        event_type: "auth_failure",
        request_id: ctx.requestId,
        function: "upload-eligibility-check",
        error_code: "AUTH_INVALID_TOKEN",
        error_message: userError?.message ?? "Unauthorized",
      });
      return new Response("Unauthorized", {
        status: 401
      });
    }
    const userId = user.id;
    try {
      requireAuthenticated(userId);
    } catch {
      return new Response("Unauthorized", {
        status: 401
      });
    }
    // Check platform admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    let isAuthorized = profile?.role === "admin";
    // Check org role if not admin
    let enforceRole = false;
    allowAdminBypass(isAuthorized, () => {
      enforceRole = true;
    });

    if (enforceRole) {
      try {
        const { userId: orgUserId, role, source } = await getUserRoleFromRequest(req, { supabase, orgId });
        requireAuthenticated(orgUserId);
        requireOrgRoleSource(source);
        requireRole(role, "member");
        isAuthorized = true;
      } catch {
        isAuthorized = false;
      }
    }
    if (!isAuthorized) {
      logEvent({
        severity: "warn",
        event_type: "permission_denied",
        request_id: ctx.requestId,
        function: "upload-eligibility-check",
        org_id: orgId,
        user_id: userId,
        error_code: "AUTH_PERMISSION_DENIED",
        error_message: "User is not authorized for org",
      });
      return new Response(JSON.stringify({
        allowed: false,
        reason: "not_authorized",
        org_id: orgId,
        file_size_bytes: fileSizeBytes,
        remaining_bytes: null,
        limit_bytes: null,
        used_bytes: null
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Fetch org storage limit
    const { data: org, error: orgError } = await supabase.from("organizations").select("storage_limit_mb").eq("id", orgId).single();
    if (orgError || !org) {
      logEvent({
        severity: "error",
        event_type: "request_error",
        request_id: ctx.requestId,
        function: "upload-eligibility-check",
        org_id: orgId,
        error_code: "ORG_NOT_FOUND",
        error_message: orgError?.message ?? "Organization not found",
      });
      return new Response("Organization not found", {
        status: 404
      });
    }
    const limit_bytes = org.storage_limit_mb * 1024 * 1024;
    // Aggregate current usage
    const { data: usage, error: usageError } = await supabase.from("media_assets").select("file_size_bytes").eq("org_id", orgId);
    if (usageError) {
      logEvent({
        severity: "error",
        event_type: "request_error",
        request_id: ctx.requestId,
        function: "upload-eligibility-check",
        org_id: orgId,
        error_code: "SUPABASE_READ_FAILED",
        error_message: usageError.message,
      });
      return new Response("Failed to calculate usage", {
        status: 500
      });
    }
    const used_bytes = usage.reduce((sum, row)=>sum + Number(row.file_size_bytes), 0);
    // If usage somehow already exceeds limit (bad data, legacy rows), remaining_bytes will be negative.
    // Fix: const remaining_bytes = Math.max(0, limit_bytes - used_bytes);
    const remaining_bytes = limit_bytes - used_bytes;
    const allowed = remaining_bytes >= fileSizeBytes;
    // Success
    return new Response(JSON.stringify({
      allowed,
      reason: allowed ? null : "storage_limit_exceeded",
      org_id: orgId,
      file_size_bytes: fileSizeBytes,
      remaining_bytes,
      limit_bytes,
      used_bytes
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent({
      severity: "error",
      event_type: "request_error",
      request_id: ctx.requestId,
      function: "upload-eligibility-check",
      error_code: "UNEXPECTED_SERVER_ERROR",
      error_message: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return new Response("Internal Server Error", {
      status: 500
    });
  }
}));

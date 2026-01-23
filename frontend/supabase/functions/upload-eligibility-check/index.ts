import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getClientBoundToRequest } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { logEvent, withObservability } from "../_shared/observability.ts";
import { allowAdminBypass, getUserRoleFromRequest, requireAuthenticated, requireOrgRoleSource, requireRole } from "../_shared/roles.ts";

serve(withObservability("upload-eligibility-check", async (req, ctx) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }

    console.warn("AUTH CLIENT DEBUG", {
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });

    const { orgId, fileSizeBytes } = await req.json();
    if (!orgId || !fileSizeBytes || fileSizeBytes <= 0) {
      return errorResponse("INVALID_REQUEST", "orgId and fileSizeBytes (> 0) are required", 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logEvent({
        severity: "warn",
        event_type: "auth_failure",
        request_id: ctx.requestId,
        function: "upload-eligibility-check",
        error_code: "AUTH_REQUIRED",
        error_message: "Missing Authorization header",
      });
      return errorResponse("AUTH_REQUIRED", "Missing Authorization header", 401);
    }

    const supabase = getClientBoundToRequest(req);

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
      return errorResponse("AUTH_INVALID_TOKEN", userError?.message || "Unauthorized", 401);
    }

    const userId = user.id;
    try {
      requireAuthenticated(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unauthorized";
      return errorResponse("AUTH_REQUIRED", message, 401);
    }

    // Check platform admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    
    if (profileError) {
      console.error("Failed to fetch user profile:", profileError);
    }

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
      } catch (err) {
        isAuthorized = false;
        console.error("User not authorized for org:", err);
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
        error_code: "FORBIDDEN",
        error_message: "User is not authorized for org",
      });
      // This is a success response but with allowed: false
      return jsonResponse({
        allowed: false,
        reason: "not_authorized",
        org_id: orgId,
        file_size_bytes: fileSizeBytes,
        remaining_bytes: null,
        limit_bytes: null,
        used_bytes: null
      }, 200);
    }

    // Fetch org storage limit
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("storage_limit_mb")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      logEvent({
        severity: "error",
        event_type: "request_error",
        request_id: ctx.requestId,
        function: "upload-eligibility-check",
        org_id: orgId,
        error_code: "ORG_LOOKUP_FAILED",
        error_message: orgError?.message ?? "Organization not found",
      });
      return errorResponse("ORG_LOOKUP_FAILED", orgError?.message || "Organization not found", 404);
    }

    const limit_bytes = org.storage_limit_mb * 1024 * 1024;

    // Aggregate current usage
    const { data: usage, error: usageError } = await supabase
      .from("media_assets")
      .select("file_size_bytes")
      .eq("org_id", orgId);

    if (usageError) {
      logEvent({
        severity: "error",
        event_type: "request_error",
        request_id: ctx.requestId,
        function: "upload-eligibility-check",
        org_id: orgId,
        error_code: "DB_QUERY_FAILED",
        error_message: usageError.message,
      });
      return errorResponse("DB_QUERY_FAILED", "Failed to calculate storage usage", 500);
    }

    const used_bytes = usage.reduce((sum, row) => sum + Number(row.file_size_bytes), 0);
    const remaining_bytes = limit_bytes - used_bytes;
    const allowed = remaining_bytes >= fileSizeBytes;

    // Success
    return jsonResponse({
      allowed,
      reason: allowed ? null : "storage_limit_exceeded",
      org_id: orgId,
      file_size_bytes: fileSizeBytes,
      remaining_bytes,
      limit_bytes,
      used_bytes
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Unexpected error in upload-eligibility-check:", err);
    logEvent({
      severity: "error",
      event_type: "request_error",
      request_id: ctx.requestId,
      function: "upload-eligibility-check",
      error_code: "UNEXPECTED_SERVER_ERROR",
      error_message: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return errorResponse("UNEXPECTED_SERVER_ERROR", "An unexpected error occurred", 500);
  }
}));

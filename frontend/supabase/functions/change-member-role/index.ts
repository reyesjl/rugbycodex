import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getAuthContext, getClientBoundToRequest } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import {
  allowAdminBypass,
  getUserRoleFromRequest,
  normalizeRole,
  requireAuthenticated,
  requireOrgRoleSource,
  requireRole,
} from "../_shared/roles.ts";
import { logEvent, withObservability } from "../_shared/observability.ts";

/**
 * Role hierarchy definition: member < staff < manager < owner
 * Lower rank = lower privilege
 */
const ROLE_RANK = {
  member: 0,
  staff: 1,
  manager: 2,
  owner: 3,
} as const;

type OrgRole = keyof typeof ROLE_RANK;

const VALID_ROLES = ["member", "staff", "manager", "owner"] as const;

type DenoServeHandler = (request: Request, info?: unknown) => Response | Promise<Response>;
declare const Deno: { serve: (handler: DenoServeHandler) => void };

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

Deno.serve(withObservability("change-member-role", async (req, ctx) => {
  try {
    // Handle CORS preflight
    const cors = handleCors(req);
    if (cors) return cors;

    if (req.method !== "POST") {
      return errorResponse(
        "METHOD_NOT_ALLOWED",
        "Only POST is allowed for this endpoint.",
        405,
      );
    }

    console.warn("AUTH CLIENT DEBUG", {
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });

    const orgIdHeader = asTrimmedString(req.headers.get("x-org-id"));
    if (!orgIdHeader) {
      return errorResponse(
        "ORG_ID_REQUIRED",
        "x-org-id header is required.",
        400,
      );
    }

    // Extract caller identity from JWT
    const { userId: callerId, isAdmin } = await getAuthContext(req);
    try {
      requireAuthenticated(callerId);
    } catch {
      return errorResponse("AUTH_REQUIRED", "Authentication required.", 401);
    }

    // Parse and validate request payload
    const body = (await req.json().catch(() => null)) as {
      orgId?: string;
      userId?: string;
      role?: string;
    } | null;
    if (!body) {
      return errorResponse("INVALID_REQUEST_BODY", "Invalid JSON body.", 400);
    }

    const orgId = asTrimmedString(body.orgId);
    const targetUserId = asTrimmedString(body.userId);
    const requestedRole = asTrimmedString(body.role);

    if (!orgId || !targetUserId || !requestedRole) {
      return errorResponse(
        "MISSING_REQUIRED_FIELDS",
        "orgId, userId, and role are required.",
        400,
      );
    }

    if (orgId !== orgIdHeader) {
      return errorResponse(
        "INVALID_REQUEST",
        "x-org-id header must match orgId in request body.",
        400,
      );
    }

    // Validate role is a known value
    if (!VALID_ROLES.includes(requestedRole as (typeof VALID_ROLES)[number])) {
      return errorResponse(
        "INVALID_REQUEST",
        `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}.`,
        400,
      );
    }

    const supabase = getClientBoundToRequest(req);

    // =========================================================================
    // Authorization: Load caller's membership to determine their authority
    // =========================================================================
    let callerRole: OrgRole | null = null;

    let enforceRole = false;
    allowAdminBypass(isAdmin, () => {
      enforceRole = true;
    });

    if (enforceRole) {
      try {
        const { role, source } = await getUserRoleFromRequest(req, { supabase, orgId });
        requireOrgRoleSource(source);
        callerRole = normalizeRole(role) as OrgRole;
        requireRole(callerRole as OrgRole, "staff");
      } catch (err) {
        const status = (err as any)?.status ?? 403;
        if (status === 401) {
          return errorResponse("AUTH_REQUIRED", "Authentication required.", 401);
        }
        return errorResponse("FORBIDDEN", "Forbidden", 403);
      }
    }

    // =========================================================================
    // Load target membership
    // =========================================================================
    const { data: targetMembership, error: targetError } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .single();

    if (targetError || !targetMembership) {
      return errorResponse(
        "NOT_FOUND",
        "Target user is not a member of this organization.",
        404,
      );
    }

    const targetRole = targetMembership.role as OrgRole;

    // =========================================================================
    // No-op check: reject if target already has the requested role
    // =========================================================================
    if (targetRole === requestedRole) {
      return errorResponse(
        "INVALID_REQUEST",
        `User already has the role: ${requestedRole}.`,
        400,
      );
    }

    // =========================================================================
    // Role hierarchy enforcement (non-admin callers only)
    // =========================================================================
    if (!isAdmin && callerRole) {
      const callerRank = ROLE_RANK[callerRole];
      const targetRank = ROLE_RANK[targetRole];
      const newRoleRank = ROLE_RANK[requestedRole as OrgRole];

      // Rule 1: Caller cannot modify a target with a HIGHER role than themselves
      // Use > (not >=) to allow equal-rank modifications (e.g., manager can demote manager)
      if (targetRank > callerRank) {
        return errorResponse(
          "FORBIDDEN",
          "You cannot modify a user with a higher role than your own.",
          403,
        );
      }

      // Rule 2: Caller cannot assign a role higher than their own
      if (newRoleRank > callerRank) {
        return errorResponse(
          "FORBIDDEN",
          "You cannot assign a role higher than your own.",
          403,
        );
      }

      // Rule 3: Only owner may assign the owner role
      if (requestedRole === "owner" && callerRole !== "owner") {
        return errorResponse(
          "FORBIDDEN",
          "Only organization owners can assign the owner role.",
          403,
        );
      }
    }

    // =========================================================================
    // Last-owner invariant: prevent leaving org without an owner
    // =========================================================================
    const isDemotingOwner = targetRole === "owner" && requestedRole !== "owner";

    if (isDemotingOwner) {
      // Count current owners in the organization
      const { count, error: countError } = await supabase
        .from("org_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("role", "owner");

      if (countError) {
        console.error("Failed to count owners:", countError);
        return errorResponse(
          "DB_QUERY_FAILED",
          "Failed to verify owner count.",
          500,
        );
      }

      // Block if this is the last owner (applies to self-demotion too)
      if (count === 1) {
        return errorResponse(
          "INVALID_REQUEST",
          "Cannot change role: organization must have at least one owner.",
          409,
        );
      }
    }

    // =========================================================================
    // Execute role update
    // =========================================================================
    const { data: updatedMembership, error: updateError } = await supabase
      .from("org_members")
      .update({ role: requestedRole })
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update member role:", updateError);
      return errorResponse("DB_QUERY_FAILED", "Failed to update member role.", 500);
    }

    // =========================================================================
    // Fetch public profile data (use public_profiles, not profiles)
    // =========================================================================
    const { data: publicProfile, error: profileError } = await supabase
      .from("public_profiles")
      .select("id, username, name, xp")
      .eq("id", targetUserId)
      .single();

    if (profileError) {
      console.error("Failed to fetch public profile:", profileError);
      // Non-fatal: return membership without profile
      return jsonResponse({
        membership: updatedMembership,
        profile: null,
      });
    }

    // =========================================================================
    // Success response
    // =========================================================================
    return jsonResponse({
      membership: updatedMembership,
      profile: publicProfile,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent({
      severity: "error",
      event_type: "request_error",
      request_id: ctx.requestId,
      function: "change-member-role",
      error_code: "UNEXPECTED_SERVER_ERROR",
      error_message: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return errorResponse("UNEXPECTED_SERVER_ERROR", "Unexpected server error.", 500);
  }
}));

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getUserRoleFromRequest, requireAuthenticated, requireOrgRoleSource, requireRole } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

Deno.serve(withObservability("set-primary-org", async (req) => {
  // Handle OPTIONS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse(
      "METHOD_NOT_ALLOWED",
      "Only POST is allowed for this endpoint.",
      405,
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse(
        "AUTH_REQUIRED",
        "Missing Authorization header.",
        401,
      );
    }

    const body = (await req.json().catch(() => null)) as
      | { orgId?: string }
      | null;

    const orgId = body?.orgId?.trim();
    if (!orgId) {
      return errorResponse(
        "ORG_ID_REQUIRED",
        "An orgId must be provided.",
        400,
      );
    }

    try {
      const { userId, role, source } = await getUserRoleFromRequest(req, { orgId });
      requireAuthenticated(userId);
      requireOrgRoleSource(source);
      requireRole(role, "viewer");
    } catch (err) {
      const status = (err as any)?.status ?? 403;
      if (status === 401) {
        return errorResponse("AUTH_REQUIRED", "You must be signed in to set your primary organization.", 401);
      }
      return errorResponse("FORBIDDEN", "Forbidden", 403);
    }

    // Identify the caller (user-scoped client)
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    );

    const {
      data: { user },
      error: userErr,
    } = await supabaseUser.auth.getUser();

    if (userErr || !user) {
      return errorResponse(
        "AUTH_REQUIRED",
        "You must be signed in to set your primary organization.",
        401,
      );
    }

    const userId = user.id;

    // Admin client for secure DB operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ensure the user is a member of the target org (prevents pointing primary_org to arbitrary orgs)
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("org_members")
      .select("org_id")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      console.error("Membership check failed:", membershipError);
      return errorResponse(
        "MEMBERSHIP_LOOKUP_FAILED",
        "Failed to validate organization membership.",
        500,
      );
    }

    if (!membership) {
      return errorResponse(
        "FORBIDDEN",
        "You must be a member of the organization to set it as primary.",
        403,
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ primary_org: orgId })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update profiles.primary_org:", updateError);
      return errorResponse(
        "PRIMARY_ORG_UPDATE_FAILED",
        "Failed to set primary organization.",
        500,
      );
    }

    return jsonResponse({ ok: true, primary_org: orgId }, 200);
  } catch (err) {
    console.error("Unexpected error:", err);
    return errorResponse(
      "UNEXPECTED_SERVER_ERROR",
      "Unexpected server error.",
      500,
    );
  }
}));

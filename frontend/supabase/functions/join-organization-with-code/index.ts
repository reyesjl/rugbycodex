import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getUserRoleFromRequest, requireAuthenticated, requireRole } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

const JOIN_CODE_TTL_MS = 24 * 60 * 60 * 1000;

Deno.serve(withObservability("join-organization-with-code", async (req) => {
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

    try {
      const { userId, role } = await getUserRoleFromRequest(req);
      requireAuthenticated(userId);
      requireRole(role, "viewer");
    } catch (err) {
      const status = (err as any)?.status ?? 403;
      if (status === 401) {
        return errorResponse("AUTH_REQUIRED", "You must be signed in to join an organization.", 401);
      }
      return errorResponse("FORBIDDEN", "Forbidden", 403);
    }

    const body = (await req.json().catch(() => null)) as
      | { joinCode?: string }
      | null;

    if (!body?.joinCode || typeof body.joinCode !== "string") {
      return errorResponse(
        "JOIN_CODE_REQUIRED",
        "A join code must be provided.",
        400,
      );
    }

    const joinCode = body.joinCode.trim();
    if (!joinCode) {
      return errorResponse(
        "JOIN_CODE_EMPTY",
        "Join code cannot be empty.",
        400,
      );
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
        "You must be signed in to join an organization.",
        401,
      );
    }

    const userId = user.id;

    // Admin client for secure DB operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find org by join code
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, slug, name, join_code_set_at, visibility, type")
      .eq("join_code", joinCode)
      .maybeSingle();

    if (orgError) {
      console.error("Org lookup failed:", orgError);
      return errorResponse(
        "ORG_LOOKUP_FAILED",
        "Failed to validate join code.",
        500,
      );
    }

    if (!org) {
      return errorResponse(
        "JOIN_CODE_INVALID",
        "This join code is not valid.",
        400,
      );
    }

    // Enforce 24 hour expiry window
    const setAtMs = new Date(org.join_code_set_at).getTime();
    if (!setAtMs || Date.now() - setAtMs > JOIN_CODE_TTL_MS) {
      return errorResponse(
        "JOIN_CODE_EXPIRED",
        "This join code has expired. Ask your coach to generate a new one.",
        400,
      );
    }

    // Prevent duplicate membership (this org)
    const { data: membership, error: memberError } = await supabaseAdmin
      .from("org_members")
      .select("role")
      .eq("org_id", org.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (memberError) {
      console.error("Membership lookup failed:", memberError);
      return errorResponse(
        "MEMBERSHIP_LOOKUP_FAILED",
        "Failed to check membership status.",
        500,
      );
    }

    if (membership) {
      return jsonResponse({
        status: "already_member",
        org: {
          id: org.id,
          slug: org.slug,
          name: org.name,
          visibility: org.visibility,
          type: org.type,
        },
      });
    }

    // Detect "first org join" (no memberships anywhere yet)
    const { data: anyMembership, error: anyMembershipError } = await supabaseAdmin
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (anyMembershipError) {
      console.error("First-join lookup failed:", anyMembershipError);
      return errorResponse(
        "FIRST_JOIN_LOOKUP_FAILED",
        "Failed to determine membership status.",
        500,
      );
    }

    const isFirstOrgJoin = !anyMembership;

    // Create membership
    const { error: insertError } = await supabaseAdmin
      .from("org_members")
      .insert({
        org_id: org.id,
        user_id: userId,
        role: "member",
      });

    if (insertError) {
      console.error("Failed to insert membership:", insertError);
      return errorResponse(
        "JOIN_FAILED",
        "Failed to join organization.",
        500,
      );
    }

    // If this was the user's first org, set primary_org (guarded: only if still null)
    if (isFirstOrgJoin) {
      const { error: primaryError } = await supabaseAdmin
        .from("profiles")
        .update({ primary_org: org.id })
        .eq("id", userId)
        .is("primary_org", null);

      if (primaryError) {
        console.error("Failed to set primary_org:", primaryError);
        // Not fatal: membership is already created. Client can still pick later.
      }
    }

    // Return success
    return jsonResponse({
      status: "joined",
      org: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        visibility: org.visibility,
        type: org.type,
      },
      membership: {
        role: "member",
        joined_at: new Date().toISOString(),
      },
      // primaryOrgSet: isFirstOrgJoin, // optional flag for client UX
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return errorResponse(
      "UNEXPECTED_SERVER_ERROR",
      "Unexpected server error.",
      500,
    );
  }
}));
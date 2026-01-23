import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getUserRoleFromRequest, requireAuthenticated, requireOrgRoleSource, requireRole } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

serve(withObservability("leave-organization", async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }

    console.warn("AUTH CLIENT DEBUG", {
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });

    const { orgId } = await req.json();
    if (!orgId) {
      return errorResponse("ORG_ID_REQUIRED", "orgId is required", 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("AUTH_REQUIRED", "Missing Authorization header", 401);
    }

    try {
      const { userId, role, source } = await getUserRoleFromRequest(req, { orgId });
      requireAuthenticated(userId);
      requireOrgRoleSource(source);
      requireRole(role, "viewer");
    } catch (err) {
      const status = (err as any)?.status ?? 403;
      const message = err instanceof Error ? err.message : (status === 401 ? "Unauthorized" : "Forbidden");
      return errorResponse(status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN", message, status);
    }

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

    // Identify current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Failed to get user:", userError);
      return errorResponse("AUTH_INVALID_TOKEN", userError?.message || "Unauthorized", 401);
    }

    const userId = user.id;

    // Fetch organization owner (canonical owner)
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("owner")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      console.error("Organization lookup failed:", orgError);
      return errorResponse("ORG_LOOKUP_FAILED", "Organization not found", 404);
    }

    // Canonical owner can NEVER leave
    if (org.owner === userId) {
      return errorResponse("FORBIDDEN", "The organization owner cannot leave their organization", 409);
    }

    // Fetch membership
    const { data: membership, error: membershipError } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single();

    if (membershipError || !membership) {
      console.error("Membership lookup failed:", membershipError);
      return errorResponse("MEMBERSHIP_LOOKUP_FAILED", "You are not a member of this organization", 404);
    }

    // Prevent last operational owner from leaving
    if (membership.role === "owner") {
      const { count, error: ownerCountError } = await supabase
        .from("org_members")
        .select("*", {
          count: "exact",
          head: true
        })
        .eq("org_id", orgId)
        .eq("role", "owner");

      if (ownerCountError) {
        console.error("Failed to count owners:", ownerCountError);
        return errorResponse("DB_QUERY_FAILED", "Failed to check owner count", 500);
      }

      if (count === 1) {
        return errorResponse("FORBIDDEN", "Cannot leave organization as the last operational owner", 409);
      }
    }

    // Remove membership
    const { error: deleteError } = await supabase
      .from("org_members")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Failed to delete membership:", deleteError);
      return errorResponse("DB_QUERY_FAILED", "Failed to remove membership", 500);
    }

    // Clear primary_org if needed
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("primary_org")
      .eq("id", userId)
      .single();

    if (!profileError && profile?.primary_org === orgId) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ primary_org: null })
        .eq("id", userId);

      if (updateError) {
        console.error("Failed to clear primary_org:", updateError);
        // Don't fail the whole operation for this
      }
    }

    // Success - 204 No Content
    return new Response(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in leave-organization:", err);
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

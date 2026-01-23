import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

serve(withObservability("transfer-ownership", async (req) => {
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

    // Parse input
    const { orgId, newOwnerId } = await req.json();
    if (!orgId || !newOwnerId) {
      return errorResponse("MISSING_REQUIRED_FIELDS", "orgId and newOwnerId are required", 400);
    }

    // Create service-role Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      console.error("Organization lookup failed:", orgError);
      return errorResponse("ORG_LOOKUP_FAILED", "Organization not found", 404);
    }

    // Ensure target user exists
    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", newOwnerId)
      .single();

    if (profileError || !targetProfile) {
      console.error("Target user lookup failed:", profileError);
      return errorResponse("INVALID_REQUEST", "Target user not found", 404);
    }

    // Ensure operational membership alignment
    const { data: membership } = await supabase
      .from("org_members")
      .select("*")
      .eq("org_id", orgId)
      .eq("user_id", newOwnerId)
      .maybeSingle();

    if (!membership) {
      // Insert membership as owner
      const { error: insertError } = await supabase
        .from("org_members")
        .insert({
          org_id: orgId,
          user_id: newOwnerId,
          role: "owner"
        });

      if (insertError) {
        console.error("Failed to insert owner membership:", insertError);
        return errorResponse("DB_QUERY_FAILED", "Failed to create owner membership", 500);
      }
    } else if (membership.role !== "owner") {
      // Promote existing member to owner
      const { error: updateRoleError } = await supabase
        .from("org_members")
        .update({ role: "owner" })
        .eq("org_id", orgId)
        .eq("user_id", newOwnerId);

      if (updateRoleError) {
        console.error("Failed to promote member to owner:", updateRoleError);
        return errorResponse("DB_QUERY_FAILED", "Failed to update member role", 500);
      }
    }

    // Update canonical owner
    const { data: updatedOrg, error: updateOrgError } = await supabase
      .from("organizations")
      .update({ owner: newOwnerId })
      .eq("id", orgId)
      .single();

    if (updateOrgError) {
      console.error("Failed to update organization owner:", updateOrgError);
      return errorResponse("DB_QUERY_FAILED", "Failed to update organization owner", 500);
    }

    return jsonResponse(updatedOrg, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Unexpected error in transfer-ownership:", err);
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

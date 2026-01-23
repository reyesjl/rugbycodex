import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

serve(withObservability("assign-organization-owner", async (req) => {
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

    const { orgId, userId: targetUserId } = await req.json();
    if (!orgId || !targetUserId) {
      return errorResponse("MISSING_REQUIRED_FIELDS", "orgId and userId are required", 400);
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

    // Ensure organization exists
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (orgError || !organization) {
      console.error("Organization lookup failed:", orgError);
      return errorResponse("ORG_LOOKUP_FAILED", "Organization not found", 404);
    }

    // Upsert owner membership
    const { error: memberError } = await supabase
      .from("org_members")
      .upsert({
        org_id: orgId,
        user_id: targetUserId,
        role: "owner"
      }, {
        onConflict: "org_id,user_id"
      });

    if (memberError) {
      console.error("Failed to upsert owner membership:", memberError);
      return errorResponse("DB_QUERY_FAILED", "Failed to ensure owner membership", 500);
    }

    // Assign canonical owner on organization
    const { data: updatedOrg, error: updateError } = await supabase
      .from("organizations")
      .update({
        owner: targetUserId
      })
      .eq("id", orgId)
      .single();

    if (updateError) {
      console.error("Failed to update organization owner:", updateError);
      return errorResponse("DB_QUERY_FAILED", "Failed to update organization owner", 500);
    }

    return jsonResponse(updatedOrg, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in assign-organization-owner:", err);
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

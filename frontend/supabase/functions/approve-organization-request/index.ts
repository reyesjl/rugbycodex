import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

serve(withObservability("approve-organization-request", async (req) => {
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

    const { requestId } = await req.json();
    if (!requestId) {
      return errorResponse("INVALID_REQUEST", "requestId is required", 400);
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

    // Fetch request
    const { data: request, error: requestError } = await supabase
      .from("organization_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      console.error("Organization request lookup failed:", requestError);
      return errorResponse("ORG_LOOKUP_FAILED", "Organization request not found", 404);
    }

    if (request.status !== "pending") {
      return errorResponse("INVALID_REQUEST", "Only pending requests can be approved", 409);
    }

    // Approve request
    const { data: updated, error: updateError } = await supabase
      .from("organization_requests")
      .update({
        status: "approved",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", requestId)
      .single();

    if (updateError) {
      console.error("Failed to approve organization request:", updateError);
      return errorResponse("DB_QUERY_FAILED", "Failed to approve organization request", 500);
    }

    return jsonResponse(updated, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in approve-organization-request:", err);
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

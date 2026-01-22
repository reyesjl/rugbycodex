import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";
serve(withObservability("reject-organization-request", async (req)=>{
  try {
    // Handle OPTIONS preflight
    const cors = handleCors(req);
    if (cors) return cors;

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders
      });
    }
    const { userId, isAdmin } = await getAuthContext(req);
    try {
      requireAuthenticated(userId);
      requirePlatformAdmin(isAdmin);
    } catch (err) {
      const status = (err as any)?.status ?? 403;
      const message = status === 401 ? "Unauthorized" : "Forbidden";
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const { requestId, notes } = await req.json();
    if (!requestId) {
      return new Response("requestId is required", {
        status: 400,
        headers: corsHeaders
      });
    }
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // Fetch request
    const { data: request, error: requestError } = await supabase.from("organization_requests").select("*").eq("id", requestId).single();
    if (requestError) {
      return new Response("Organization request not found", {
        status: 404,
        headers: corsHeaders
      });
    }
    if (request.status !== "pending") {
      return new Response("Only pending requests can be rejected", {
        status: 409,
        headers: corsHeaders
      });
    }
    // Reject request
    const { data: updated, error: updateError } = await supabase.from("organization_requests").update({
      status: "rejected",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: notes ?? null
    }).eq("id", requestId).single();
    if (updateError) {
      throw updateError;
    }
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error(err);
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders
    });
  }
}));

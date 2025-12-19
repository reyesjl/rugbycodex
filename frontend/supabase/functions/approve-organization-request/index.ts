import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
serve(async (req)=>{
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }
    const { userId, isAdmin } = await getAuthContext(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
    const { requestId } = await req.json();
    if (!requestId) {
      return new Response("requestId is required", {
        status: 400
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
        status: 404
      });
    }
    if (request.status !== "pending") {
      return new Response("Only pending requests can be approved", {
        status: 409
      });
    }
    // Approve request
    const { data: updated, error: updateError } = await supabase.from("organization_requests").update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString()
    }).eq("id", requestId).single();
    if (updateError) {
      throw updateError;
    }
    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error(err);
    return new Response("Internal Server Error", {
      status: 500
    });
  }
});

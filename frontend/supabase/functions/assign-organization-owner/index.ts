import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { withObservability } from "../_shared/observability.ts";
serve(withObservability("assign-organization-owner", async (req)=>{
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
    const { orgId, userId: targetUserId } = await req.json();
    if (!orgId || !targetUserId) {
      return new Response("orgId and userId are required", {
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
    // Ensure organization exists
    const { data: organization, error: orgError } = await supabase.from("organizations").select("*").eq("id", orgId).single();
    if (orgError || !organization) {
      return new Response("Organization not found", {
        status: 404
      });
    }
    // Upsert owner membership
    const { error: memberError } = await supabase.from("org_members").upsert({
      org_id: orgId,
      user_id: targetUserId,
      role: "owner"
    }, {
      onConflict: "org_id,user_id"
    });
    if (memberError) {
      console.error(memberError);
      return new Response("Failed to ensure owner membership", {
        status: 500
      });
    }
    // Assign canonical owner on organization
    const { data: updatedOrg, error: updateError } = await supabase.from("organizations").update({
      owner: targetUserId
    }).eq("id", orgId).single();
    if (updateError) {
      console.error(updateError);
      return new Response("Failed to update organization owner", {
        status: 500
      });
    }
    // Success
    return new Response(JSON.stringify(updatedOrg), {
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
}));

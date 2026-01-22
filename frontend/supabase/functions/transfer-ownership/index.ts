import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { withObservability } from "../_shared/observability.ts";
serve(withObservability("transfer-ownership", async (req)=>{
  try {
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
    // Parse input
    const { orgId, newOwnerId } = await req.json();
    if (!orgId || !newOwnerId) {
      return new Response("Missing orgId or newOwnerId", {
        status: 400
      });
    }
    // Create service-role Supabase client
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    // Load organization
    const { data: org, error: orgError } = await supabase.from("organizations").select("*").eq("id", orgId).single();
    if (orgError || !org) {
      return new Response("Organization not found", {
        status: 404
      });
    }
    // Ensure target user exists
    const { data: targetProfile, error: profileError } = await supabase.from("profiles").select("id").eq("id", newOwnerId).single();
    if (profileError || !targetProfile) {
      return new Response("Target user not found", {
        status: 404
      });
    }
    // Ensure operational membership alignment
    // Target must be an org member with role = 'owner'
    const { data: membership } = await supabase.from("org_members").select("*").eq("org_id", orgId).eq("user_id", newOwnerId).maybeSingle();
    if (!membership) {
      // Insert membership as owner
      const { error: insertError } = await supabase.from("org_members").insert({
        org_id: orgId,
        user_id: newOwnerId,
        role: "owner"
      });
      if (insertError) {
        throw insertError;
      }
    } else if (membership.role !== "owner") {
      // Promote existing member to owner
      const { error: updateRoleError } = await supabase.from("org_members").update({
        role: "owner"
      }).eq("org_id", orgId).eq("user_id", newOwnerId);
      if (updateRoleError) {
        throw updateRoleError;
      }
    }
    // Update canonical owner
    const { data: updatedOrg, error: updateOrgError } = await supabase.from("organizations").update({
      owner: newOwnerId
    }).eq("id", orgId).single();
    if (updateOrgError) {
      throw updateOrgError;
    }
    // Return updated organization
    return new Response(JSON.stringify(updatedOrg), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("transfer-ownership error:", err);
    return new Response("Internal server error", {
      status: 500
    });
  }
}));

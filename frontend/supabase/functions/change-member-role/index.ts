import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { getAuthContext } from "../_shared/auth.ts";
serve(async (req)=>{
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
    const { orgId, userId: targetUserId, role } = await req.json();
    if (!orgId || !targetUserId || !role) {
      return new Response("Missing parameters", {
        status: 400
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    // Load target membership
    const { data: targetMembership, error: targetError } = await supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", targetUserId).single();
    if (targetError) {
      return new Response("Target member not found", {
        status: 404
      });
    }
    // Invariant: must retain at least one operational owner
    const isDemotingOwner = targetMembership.role === "owner" && role !== "owner";
    if (isDemotingOwner) {
      const { count } = await supabase.from("org_members").select("*", {
        count: "exact",
        head: true
      }).eq("org_id", orgId).eq("role", "owner");
      if (count === 1) {
        return new Response("Organization must have at least one owner", {
          status: 409
        });
      }
    }
    // Update role
    const { data: updatedMembership, error: updateError } = await supabase.from("org_members").update({
      role
    }).eq("org_id", orgId).eq("user_id", targetUserId).single();
    if (updateError) {
      throw updateError;
    }
    // Fetch profile
    const { data: profile } = await supabase.from("profiles").select("id, username, name, role").eq("id", targetUserId).single();
    return new Response(JSON.stringify({
      membership: updatedMembership,
      profile
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error(err);
    return new Response("Internal server error", {
      status: 500
    });
  }
});

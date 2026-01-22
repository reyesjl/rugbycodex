import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withObservability } from "../_shared/observability.ts";
serve(withObservability("leave-organization", async (req)=>{
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }
    const { orgId } = await req.json();
    if (!orgId) {
      return new Response("orgId is required", {
        status: 400
      });
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Missing Authorization header", {
        status: 401
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // Identify current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response("Unauthorized", {
        status: 401
      });
    }
    const userId = user.id;
    // Fetch organization owner (canonical owner)
    const { data: org, error: orgError } = await supabase.from("organizations").select("owner").eq("id", orgId).single();
    if (orgError) {
      return new Response("Organization not found", {
        status: 404
      });
    }
    // Canonical owner can NEVER leave
    if (org.owner === userId) {
      return new Response("The organization owner cannot leave their organization", {
        status: 409
      });
    }
    // Fetch membership
    const { data: membership, error: membershipError } = await supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).single();
    if (membershipError) {
      return new Response("You are not a member of this organization", {
        status: 404
      });
    }
    // Prevent last operational owner from leaving
    if (membership.role === "owner") {
      const { count, error: ownerCountError } = await supabase.from("org_members").select("*", {
        count: "exact",
        head: true
      }).eq("org_id", orgId).eq("role", "owner");
      if (ownerCountError) {
        throw ownerCountError;
      }
      if (count === 1) {
        return new Response("Cannot leave organization as the last operational owner", {
          status: 409
        });
      }
    }
    // Remove membership
    const { error: deleteError } = await supabase.from("org_members").delete().eq("org_id", orgId).eq("user_id", userId);
    if (deleteError) {
      throw deleteError;
    }
    // Clear primary_org if needed
    const { data: profile, error: profileError } = await supabase.from("profiles").select("primary_org").eq("id", userId).single();
    if (!profileError && profile.primary_org === orgId) {
      await supabase.from("profiles").update({
        primary_org: null
      }).eq("id", userId);
    }
    // Success
    return new Response(null, {
      status: 204
    });
  } catch (err) {
    console.error(err);
    return new Response("Internal Server Error", {
      status: 500
    });
  }
}));

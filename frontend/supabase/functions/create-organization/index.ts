import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";
serve(withObservability("create-organization", async (req)=>{
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }
    const { name, slug, owner_id, type, visibility, bio, storage_limit_mb, set_primary_org = true } = await req.json();
    if (!name || !slug || !owner_id) {
      return new Response("name, slug, and owner_id are required", {
        status: 400
      });
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Missing Authorization header", {
        status: 401
      });
    }
    const authContext = await getAuthContext(req);
    try {
      requireAuthenticated(authContext.userId);
    } catch {
      return new Response("Unauthorized", {
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
    // Identify caller
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response("Unauthorized", {
        status: 401
      });
    }
    // Verify platform admin / moderator
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const isPlatformAdmin = authContext.isAdmin || [
      "admin",
      "moderator"
    ].includes(profile.role);
    try {
      requirePlatformAdmin(isPlatformAdmin);
    } catch {
      return new Response("Forbidden", {
        status: 403
      });
    }
    // Create organization
    const { data: organization, error: orgError } = await supabase.from("organizations").insert({
      name,
      slug,
      owner: owner_id,
      type: type ?? null,
      visibility: visibility ?? "private",
      bio: bio ?? null,
      storage_limit_mb: storage_limit_mb ?? 1024
    }).single();
    if (orgError) {
      console.error(orgError);
      return new Response("Failed to create organization", {
        status: 500
      });
    }
    const orgId = organization.id;
    // Create canonical owner membership
    const { error: memberError } = await supabase.from("org_members").insert({
      org_id: orgId,
      user_id: owner_id,
      role: "owner"
    });
    if (memberError) {
      console.error(memberError);
      // rollback org if membership creation fails
      await supabase.from("organizations").delete().eq("id", orgId);
      return new Response("Failed to create owner membership", {
        status: 500
      });
    }
    // Optionally set primary_org for owner
    if (set_primary_org) {
      await supabase.from("profiles").update({
        primary_org: orgId
      }).eq("id", owner_id);
    }
    // Success
    return new Response(JSON.stringify(organization), {
      status: 201,
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

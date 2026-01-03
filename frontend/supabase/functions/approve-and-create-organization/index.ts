import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
serve(async (req) => {
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
    const { requestId, set_primary_org = true } = await req.json();
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
    // Fetch organization request
    const { data: request, error: requestError } = await supabase.from("organization_requests").select("*").eq("id", requestId).single();
    if (requestError) {
      return new Response("Organization request not found", {
        status: 404
      });
    }
    if (request.status !== "pending") {
      return new Response("Only pending requests can be approved and created", {
        status: 409
      });
    }

    // Generate unique slug from name
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };

    let slug = generateSlug(request.requested_name);
    let slugSuffix = 1;
    let isSlugUnique = false;

    // Ensure slug uniqueness
    while (!isSlugUnique) {
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (!existingOrg) {
        isSlugUnique = true;
      } else {
        slug = `${generateSlug(request.requested_name)}-${slugSuffix}`;
        slugSuffix++;
      }
    }

    // Create organization
    const { data: organization, error: orgError } = await supabase.from("organizations").insert({
      name: request.requested_name,
      slug: slug,
      owner: request.requester_id,
      type: request.requested_type ?? null,
      visibility: "private"
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
      user_id: request.requester_id,
      role: "owner"
    });
    if (memberError) {
      console.error(memberError);
      // rollback organization if membership creation fails
      await supabase.from("organizations").delete().eq("id", orgId);
      return new Response("Failed to create owner membership", {
        status: 500
      });
    }
    // Approve request and link org
    const { data: updatedRequest, error: updateError } = await supabase.from("organization_requests").update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      organization_id: orgId
    }).eq("id", requestId).single();
    if (updateError) {
      console.error(updateError);
      return new Response("Organization created but failed to update request", {
        status: 500
      });
    }
    // Optionally set primary_org for owner
    if (set_primary_org) {
      await supabase.from("profiles").update({
        primary_org: orgId
      }).eq("id", request.requester_id);
    }
    // Success
    return new Response(JSON.stringify({
      request: updatedRequest,
      organization
    }), {
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
});

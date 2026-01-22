import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { withObservability } from "../_shared/observability.ts";
serve(withObservability("approve-and-create-organization", async (req) => {
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
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const { requestId, set_primary_org = true } = await req.json();
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
    // Fetch organization request
    const { data: request, error: requestError } = await supabase.from("organization_requests").select("*").eq("id", requestId).single();
    if (requestError) {
      return new Response("Organization request not found", {
        status: 404,
        headers: corsHeaders
      });
    }
    if (request.status !== "pending") {
      return new Response("Only pending requests can be approved and created", {
        status: 409,
        headers: corsHeaders
      });
    }

    // Generate unique slug from name
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };

    // Generate random 9-digit join code (may include leading zeros)
    const generateJoinCode = (): string => {
      const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000_000;
      return String(n).padStart(9, "0");
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

    // Ensure join code uniqueness (best-effort; no DB unique constraint)
    const JOIN_CODE_MAX_ATTEMPTS = 25;
    let joinCode = "";
    for (let attempt = 0; attempt < JOIN_CODE_MAX_ATTEMPTS; attempt++) {
      const candidate = generateJoinCode();
      const { data: existingByCode, error: codeLookupError } = await supabase
        .from("organizations")
        .select("id")
        .eq("join_code", candidate)
        .maybeSingle();

      if (codeLookupError) {
        console.error(codeLookupError);
        return new Response("Failed to generate join code", {
          status: 500,
          headers: corsHeaders
        });
      }

      if (!existingByCode) {
        joinCode = candidate;
        break;
      }
    }

    if (!joinCode) {
      return new Response("Failed to generate unique join code", {
        status: 500,
        headers: corsHeaders
      });
    }

    // Create organization
    const { data: organization, error: orgError } = await supabase.from("organizations").insert({
      name: request.requested_name,
      slug: slug,
      owner: request.requester_id,
      type: request.requested_type ?? null,
      visibility: "private",
      join_code: joinCode,
      join_code_set_at: new Date().toISOString()
    }).select("*").single();
    if (orgError) {
      console.error("Failed to create organization:", orgError);
      return new Response("Failed to create organization", {
        status: 500,
        headers: corsHeaders
      });
    }
    if (!organization?.id) {
      console.error("Organization insert returned no row:", {
        requestId,
        requester_id: request.requester_id,
        slug,
        joinCode
      });
      return new Response("Failed to create organization", {
        status: 500,
        headers: corsHeaders
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
        status: 500,
        headers: corsHeaders
      });
    }
    // Approve request and link org
    const { data: updatedRequest, error: updateError } = await supabase.from("organization_requests").update({
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      organization_id: orgId
    }).eq("id", requestId).select("*").single();
    if (updateError) {
      console.error("Failed to update organization request after org creation:", updateError);
      return new Response("Organization created but failed to update request", {
        status: 500,
        headers: corsHeaders
      });
    }
    if (!updatedRequest?.id) {
      console.error("Request update returned no row:", { requestId, orgId });
      return new Response("Organization created but failed to update request", {
        status: 500,
        headers: corsHeaders
      });
    }
    // Optionally set primary_org for owner
    // if (set_primary_org) {
    //   await supabase.from("profiles").update({
    //     primary_org: orgId
    //   }).eq("id", request.requester_id);
    // }
    // Success
    return new Response(JSON.stringify({
      request: updatedRequest,
      organization
    }), {
      status: 201,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("approve-and-create-organization unexpected error:", err);
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders
    });
  }
}));

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getAuthContext } from "../_shared/auth.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

Deno.serve(withObservability("create-organization", async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }

    const { name, slug, owner_id, type, visibility, bio, storage_limit_mb, set_primary_org = true } = await req.json();
    if (!name || !slug || !owner_id) {
      return errorResponse("MISSING_REQUIRED_FIELDS", "name, slug, and owner_id are required", 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("AUTH_REQUIRED", "Missing Authorization header", 401);
    }

    const authContext = await getAuthContext(req);
    try {
      requireAuthenticated(authContext.userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unauthorized";
      return errorResponse("AUTH_REQUIRED", message, 401);
    }

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

    // Identify caller
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Failed to get user:", userError);
      return errorResponse("AUTH_INVALID_TOKEN", userError?.message || "Unauthorized", 401);
    }

    // Verify platform admin / moderator
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isPlatformAdmin = authContext.isAdmin || ["admin", "moderator"].includes(profile?.role);
    try {
      requirePlatformAdmin(isPlatformAdmin);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Forbidden";
      return errorResponse("FORBIDDEN", message, 403);
    }

    // Create organization
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name,
        slug,
        owner: owner_id,
        type: type ?? null,
        visibility: visibility ?? "private",
        bio: bio ?? null,
        storage_limit_mb: storage_limit_mb ?? 1024
      })
      .select()
      .single();

    if (orgError) {
      console.error("Failed to create organization:", orgError);
      return errorResponse("DB_QUERY_FAILED", "Failed to create organization", 500);
    }

    const orgId = organization.id;

    // Create canonical owner membership
    const { error: memberError } = await supabase
      .from("org_members")
      .insert({
        org_id: orgId,
        user_id: owner_id,
        role: "owner"
      });

    if (memberError) {
      console.error("Failed to create owner membership:", memberError);
      // Rollback org if membership creation fails
      await supabase.from("organizations").delete().eq("id", orgId);
      return errorResponse("DB_QUERY_FAILED", "Failed to create owner membership", 500);
    }

    // Optionally set primary_org for owner
    if (set_primary_org) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ primary_org: orgId })
        .eq("id", owner_id);

      if (updateError) {
        console.error("Failed to set primary_org:", updateError);
        // Don't fail the whole operation for this
      }
    }

    return jsonResponse(organization, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in create-organization:", err);
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

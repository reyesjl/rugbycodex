import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getAuthContext } from "../_shared/auth.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

Deno.serve(withObservability("list-organization-requests", async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }

    const filters = await req.json();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("AUTH_REQUIRED", "Missing Authorization header", 401);
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
    const authContext = await getAuthContext(req);
    try {
      requireAuthenticated(authContext.userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unauthorized";
      return errorResponse("AUTH_REQUIRED", message, 401);
    }

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

    if (profileError) {
      console.error("Profile lookup failed:", profileError);
      return errorResponse("FORBIDDEN", "Profile not found", 403);
    }

    const isPlatformAdmin = authContext.isAdmin || ["admin", "moderator"].includes(profile.role);
    try {
      requirePlatformAdmin(isPlatformAdmin);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Forbidden";
      return errorResponse("FORBIDDEN", message, 403);
    }

    // Build query
    let query = supabase.from("organization_requests").select(`
        id,
        requester_id,
        requested_name,
        requested_type,
        message,
        status,
        reviewed_by,
        reviewed_at,
        review_notes,
        organization_id,
        created_at,
        updated_at,
        requester:profiles!organization_requests_requester_fkey (
          id,
          username,
          name,
          role
        ),
        reviewer:profiles!organization_requests_reviewer_fkey (
          id,
          username,
          name,
          role
        )
      `);

    // Apply filters
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.requested_type) {
      query = query.eq("requested_type", filters.requested_type);
    }
    if (filters?.requester_id) {
      query = query.eq("requester_id", filters.requester_id);
    }
    if (filters?.reviewed_by) {
      query = query.eq("reviewed_by", filters.reviewed_by);
    }
    if (filters?.created_after) {
      query = query.gte("created_at", filters.created_after);
    }
    if (filters?.created_before) {
      query = query.lte("created_at", filters.created_before);
    }
    if (filters?.search) {
      query = query.or(`requested_name.ilike.%${filters.search}%`);
    }

    const limit = filters?.limit ?? 25;
    const offset = filters?.offset ?? 0;
    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    // Execute
    const { data, error } = await query;
    if (error) {
      console.error("Query failed:", error);
      return errorResponse("DB_QUERY_FAILED", "Failed to fetch organization requests", 500);
    }

    return jsonResponse(data, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in list-organization-requests:", err);
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

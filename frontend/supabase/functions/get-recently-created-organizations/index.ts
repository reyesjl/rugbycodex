import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getAuthContext } from "../_shared/auth.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

const DEFAULT_LIMIT = 20;

Deno.serve(withObservability("get-recently-created-organizations", async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }

    const { userId, isAdmin } = await getAuthContext(req);
    try {
      requireAuthenticated(userId);
      requirePlatformAdmin(isAdmin);
    } catch (err) {
      const status = (err as any)?.status ?? 403;
      const message = err instanceof Error ? err.message : (status === 401 ? "Unauthorized" : "Forbidden");
      return errorResponse(status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN", message, status);
    }

    const authHeader = req.headers.get("Authorization")!;
    const { limit } = await req.json().catch(() => ({}));

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

    const pageLimit = Math.min(limit ?? DEFAULT_LIMIT, 100);

    // Load recently created organizations
    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("id, owner, slug, name, created_at, storage_limit_mb, bio, visibility, type")
      .order("created_at", { ascending: false })
      .limit(pageLimit);

    if (orgError || !organizations) {
      console.error("Failed to load organizations:", orgError);
      return errorResponse("DB_QUERY_FAILED", "Failed to load organizations", 500);
    }

    const orgIds = organizations.map((o) => o.id);

    // Member counts
    const { data: memberCounts } = await supabase
      .from("org_members")
      .select("org_id", { count: "exact" })
      .in("org_id", orgIds);

    const membersByOrg: Record<string, number> = {};
    for (const row of memberCounts ?? []) {
      membersByOrg[row.org_id] = (membersByOrg[row.org_id] ?? 0) + 1;
    }

    // Last activity (uploads or jobs)
    const { data: uploads } = await supabase
      .from("media_assets")
      .select("org_id, created_at")
      .in("org_id", orgIds);

    const { data: jobs } = await supabase
      .from("jobs")
      .select("org_id, created_at")
      .in("org_id", orgIds);

    const lastActivityByOrg: Record<string, string> = {};
    for (const row of [...uploads ?? [], ...jobs ?? []]) {
      const ts = row.created_at;
      if (!ts) continue;
      const prev = lastActivityByOrg[row.org_id];
      if (!prev || new Date(ts) > new Date(prev)) {
        lastActivityByOrg[row.org_id] = ts;
      }
    }

    // Shape response
    const result = organizations.map((org) => ({
      organization: org,
      member_count: membersByOrg[org.id] ?? 0,
      last_activity_at: lastActivityByOrg[org.id] ?? null
    }));

    return jsonResponse(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Unexpected error in get-recently-created-organizations:", err);
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

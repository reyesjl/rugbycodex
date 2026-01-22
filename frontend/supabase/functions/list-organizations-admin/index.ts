import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";
serve(withObservability("list-organizations-admin", async (req)=>{
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }
    const { userId, isAdmin } = await getAuthContext(req);
    try {
      requireAuthenticated(userId);
      requirePlatformAdmin(isAdmin);
    } catch (err) {
      const status = (err as any)?.status ?? 403;
      const message = status === 401 ? "Unauthorized" : "Forbidden";
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json" }
      });
    }
    const { search, owner_id, visibility, type, created_after, created_before, limit = 20, offset = 0 } = await req.json() ?? {};
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // Base organization query
    let orgQuery = supabase.from("organizations").select("id, owner, slug, name, created_at, storage_limit_mb, bio, visibility, type").order("created_at", {
      ascending: false
    }).range(offset, offset + limit - 1);
    if (owner_id) {
      orgQuery = orgQuery.eq("owner", owner_id);
    }
    if (visibility) {
      orgQuery = orgQuery.eq("visibility", visibility);
    }
    if (type) {
      orgQuery = orgQuery.eq("type", type);
    }
    if (created_after) {
      orgQuery = orgQuery.gte("created_at", created_after);
    }
    if (created_before) {
      orgQuery = orgQuery.lte("created_at", created_before);
    }
    if (search) {
      orgQuery = orgQuery.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    }
    const { data: organizations, error: orgsError } = await orgQuery;
    if (orgsError) {
      console.error(orgsError);
      return new Response("Failed to fetch organizations", {
        status: 500
      });
    }
    // Enrich with optional admin metrics (N+1, intentionally simple)
    const rows = [];
    for (const org of organizations ?? []){
      // member count
      const { count: memberCount } = await supabase.from("org_members").select("*", {
        count: "exact",
        head: true
      }).eq("org_id", org.id);
      // storage usage
      const { data: assets } = await supabase.from("media_assets").select("file_size_bytes").eq("org_id", org.id);
      const storageUsed = assets?.reduce((sum, r)=>sum + Number(r.file_size_bytes), 0) ?? 0;
      // last activity (upload or job)
      const { data: lastUpload } = await supabase.from("media_assets").select("created_at").eq("org_id", org.id).order("created_at", {
        ascending: false
      }).limit(1).maybeSingle();
      const { data: lastJob } = await supabase.from("jobs").select("created_at").eq("org_id", org.id).order("created_at", {
        ascending: false
      }).limit(1).maybeSingle();
      const lastActivityAt = lastJob?.created_at && lastUpload?.created_at ? new Date(Math.max(new Date(lastJob.created_at).getTime(), new Date(lastUpload.created_at).getTime())).toISOString() : lastJob?.created_at ?? lastUpload?.created_at ?? null;
      rows.push({
        organization: org,
        member_count: memberCount ?? 0,
        storage_used_bytes: storageUsed,
        last_activity_at: lastActivityAt,
        health_status: undefined
      });
    }
    // Response — OrganizationAdminListItem[]
    return new Response(JSON.stringify(rows), {
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

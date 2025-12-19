import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
const DEFAULT_LIMIT = 20;
serve(async (req)=>{
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
    const authHeader = req.headers.get("Authorization")!;
    const { limit } = await req.json().catch(()=>({}));
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const computedAt = new Date().toISOString();
    const pageLimit = Math.min(limit ?? DEFAULT_LIMIT, 100);
    // ------------------------------------------------------------------
    // Load recently created organizations
    // ------------------------------------------------------------------
    const { data: organizations, error: orgError } = await supabase.from("organizations").select("id, owner, slug, name, created_at, storage_limit_mb, bio, visibility, type").order("created_at", {
      ascending: false
    }).limit(pageLimit);
    if (orgError || !organizations) {
      throw orgError;
    }
    const orgIds = organizations.map((o)=>o.id);
    // ------------------------------------------------------------------
    // Member counts
    // ------------------------------------------------------------------
    const { data: memberCounts } = await supabase.from("org_members").select("org_id", {
      count: "exact"
    }).in("org_id", orgIds);
    const membersByOrg = {};
    for (const row of memberCounts ?? []){
      membersByOrg[row.org_id] = (membersByOrg[row.org_id] ?? 0) + 1;
    }
    // ------------------------------------------------------------------
    // Last activity (uploads or jobs)
    // ------------------------------------------------------------------
    const { data: uploads } = await supabase.from("media_assets").select("org_id, created_at").in("org_id", orgIds);
    const { data: jobs } = await supabase.from("jobs").select("org_id, created_at").in("org_id", orgIds);
    const lastActivityByOrg = {};
    for (const row of [
      ...uploads ?? [],
      ...jobs ?? []
    ]){
      const ts = row.created_at;
      if (!ts) continue;
      const prev = lastActivityByOrg[row.org_id];
      if (!prev || new Date(ts) > new Date(prev)) {
        lastActivityByOrg[row.org_id] = ts;
      }
    }
    // ------------------------------------------------------------------
    // Shape response
    // ------------------------------------------------------------------
    const result = organizations.map((org)=>({
        organization: org,
        member_count: membersByOrg[org.id] ?? 0,
        last_activity_at: lastActivityByOrg[org.id] ?? null
      }));
    return new Response(JSON.stringify(result), {
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
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";
const INACTIVITY_DAYS = 30;
const DEFAULT_LIMIT = 50;
serve(withObservability("get-inactive-organizations", async (req)=>{
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
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const computedAt = new Date().toISOString();
    const cutoffDate = new Date(Date.now() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    // ------------------------------------------------------------
    // Load candidate organizations (older than cutoff)
    // ------------------------------------------------------------
    const { data: organizations, error: orgError } = await supabase.from("organizations").select("id, owner, slug, name, created_at, storage_limit_mb, bio, visibility, type").lt("created_at", cutoffDate).order("created_at", {
      ascending: true
    }).limit(DEFAULT_LIMIT);
    if (orgError || !organizations) {
      throw orgError;
    }
    if (organizations.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const orgIds = organizations.map((o)=>o.id);
    // ------------------------------------------------------------
    // Last upload per org
    // ------------------------------------------------------------
    const { data: uploads } = await supabase.from("media_assets").select("org_id, created_at").in("org_id", orgIds);
    const lastUploadByOrg = {};
    for (const row of uploads ?? []){
      const prev = lastUploadByOrg[row.org_id];
      if (!prev || new Date(row.created_at) > new Date(prev)) {
        lastUploadByOrg[row.org_id] = row.created_at;
      }
    }
    // ------------------------------------------------------------
    // Last job per org
    // ------------------------------------------------------------
    const { data: jobs } = await supabase.from("jobs").select("org_id, created_at").in("org_id", orgIds);
    const lastJobByOrg = {};
    for (const row of jobs ?? []){
      const prev = lastJobByOrg[row.org_id];
      if (!prev || new Date(row.created_at) > new Date(prev)) {
        lastJobByOrg[row.org_id] = row.created_at;
      }
    }
    // ------------------------------------------------------------
    // Member counts (optional admin signal)
    // ------------------------------------------------------------
    const { data: members } = await supabase.from("org_members").select("org_id");
    const memberCountByOrg = {};
    for (const row of members ?? []){
      memberCountByOrg[row.org_id] = (memberCountByOrg[row.org_id] ?? 0) + 1;
    }
    // ------------------------------------------------------------
    // Apply inactivity heuristic
    // ------------------------------------------------------------
    const inactiveOrgs = organizations.filter((org)=>{
      const lastUpload = lastUploadByOrg[org.id];
      const lastJob = lastJobByOrg[org.id];
      const uploadInactive = !lastUpload || new Date(lastUpload) < new Date(cutoffDate);
      const jobInactive = !lastJob || new Date(lastJob) < new Date(cutoffDate);
      return uploadInactive && jobInactive;
    });
    // ------------------------------------------------------------
    // Shape response
    // ------------------------------------------------------------
    const result = inactiveOrgs.map((org)=>({
        organization: org,
        member_count: memberCountByOrg[org.id] ?? 0,
        last_activity_at: lastUploadByOrg[org.id] ?? lastJobByOrg[org.id] ?? null,
        health_status: "unknown"
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
}));

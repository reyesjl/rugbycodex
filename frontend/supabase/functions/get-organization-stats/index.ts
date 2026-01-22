import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import {
  allowAdminBypass,
  getUserRoleFromRequest,
  requireAuthenticated,
  requireOrgRoleSource,
  requireRole,
} from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";
serve(withObservability("get-organization-stats", async (req)=>{
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }
    const { userId, isAdmin } = await getAuthContext(req);
    try {
      requireAuthenticated(userId);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    const { orgId } = await req.json();
    if (!orgId) {
      return new Response("orgId is required", {
        status: 400
      });
    }
    let enforceRole = false;
    allowAdminBypass(isAdmin, () => {
      enforceRole = true;
    });

    if (enforceRole) {
      try {
        const { userId: orgUserId, role, source } = await getUserRoleFromRequest(req, { orgId });
        requireAuthenticated(orgUserId);
        requireOrgRoleSource(source);
        requireRole(role, "manager");
      } catch {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
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
    // ---------------------------------------------------------------------
    // Member count
    // ---------------------------------------------------------------------
    const { count: memberCount } = await supabase.from("org_members").select("*", {
      count: "exact",
      head: true
    }).eq("org_id", orgId);
    // ---------------------------------------------------------------------
    // Media assets: count + storage
    // ---------------------------------------------------------------------
    const { data: assets } = await supabase.from("media_assets").select("file_size_bytes").eq("org_id", orgId);
    const totalStorageBytes = assets?.reduce((sum, row)=>sum + Number(row.file_size_bytes), 0) ?? 0;
    const mediaAssetCount = assets?.length ?? 0;
    // Last upload (DB-sorted, single row)
    const { data: lastUpload } = await supabase.from("media_assets").select("created_at").eq("org_id", orgId).order("created_at", {
      ascending: false
    }).limit(1).maybeSingle();
    const lastUploadAt = lastUpload?.created_at ?? null;
    // ---------------------------------------------------------------------
    // Jobs: count + last job
    // ---------------------------------------------------------------------
    const { count: jobsCount } = await supabase.from("jobs").select("*", {
      count: "exact",
      head: true
    }).eq("org_id", orgId);
    const { data: lastJob } = await supabase.from("jobs").select("created_at").eq("org_id", orgId).order("created_at", {
      ascending: false
    }).limit(1).maybeSingle();
    const lastJobAt = lastJob?.created_at ?? null;
    // ---------------------------------------------------------------------
    // Response — OrgStats (exact contract)
    // ---------------------------------------------------------------------
    return new Response(JSON.stringify({
      org_id: orgId,
      member_count: memberCount ?? 0,
      media_asset_count: mediaAssetCount,
      total_storage_bytes: totalStorageBytes,
      jobs_count: jobsCount ?? 0,
      last_upload_at: lastUploadAt,
      last_job_at: lastJobAt,
      computed_at: computedAt
    }), {
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

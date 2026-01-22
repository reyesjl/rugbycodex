import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { withObservability } from "../_shared/observability.ts";
serve(withObservability("get-organization-overview", async (req)=>{
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
    const { orgId } = await req.json();
    if (!orgId) {
      return new Response("orgId is required", {
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
    const computedAt = new Date().toISOString();
    // Organization
    const { data: organization, error: orgError } = await supabase.from("organizations").select("id, owner, slug, name, created_at, storage_limit_mb, bio, visibility, type").eq("id", orgId).single();
    if (orgError || !organization) {
      return new Response("Organization not found", {
        status: 404
      });
    }
    // Membership + authorization
    const { data: membership } = await supabase.from("org_members").select("org_id, user_id, role, joined_at").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
    // Storage usage
    const { data: assets } = await supabase.from("media_assets").select("file_size_bytes").eq("org_id", orgId);
    const usedBytes = assets?.reduce((sum, row)=>sum + Number(row.file_size_bytes), 0) ?? 0;
    const limitBytes = organization.storage_limit_mb * 1024 * 1024;
    const remainingBytes = Math.max(0, limitBytes - usedBytes);
    const THRESHOLD_PERCENTAGE = 0.75;
    const nearLimit = usedBytes / limitBytes >= THRESHOLD_PERCENTAGE;
    // Last upload (DB-sorted, single row)
    const { data: lastUpload } = await supabase.from("media_assets").select("created_at").eq("org_id", orgId).order("created_at", {
      ascending: false
    }).limit(1).maybeSingle();
    const lastUploadAt = lastUpload?.created_at ?? null;
    // Recent uploads
    const { data: recentUploads } = await supabase.from("media_assets").select("id, org_id, uploader_id, bucket, storage_path, file_name, file_size_bytes, mime_type, duration_seconds, status, created_at").eq("org_id", orgId).order("created_at", {
      ascending: false
    }).limit(5);
    // Jobs (limited)
    const { data: jobs } = await supabase.from("jobs").select("id, org_id, type, state, progress, error_code, error_message, created_by, created_at, started_at, finished_at").eq("org_id", orgId).order("created_at", {
      ascending: false
    }).limit(10);
    const byState = {};
    for (const job of jobs ?? []){
      byState[job.state] = (byState[job.state] ?? 0) + 1;
    }
    // Last job (DB-sorted, single row)
    const { data: lastJob } = await supabase.from("jobs").select("created_at").eq("org_id", orgId).order("created_at", {
      ascending: false
    }).limit(1).maybeSingle();
    const lastJobAt = lastJob?.created_at ?? null;
    // Member count
    const { count: memberCount } = await supabase.from("org_members").select("*", {
      count: "exact",
      head: true
    }).eq("org_id", orgId);
    // Response — OrgOverview
    return new Response(JSON.stringify({
      organization,
      membership,
      stats: {
        org_id: orgId,
        member_count: memberCount ?? 0,
        media_asset_count: assets?.length ?? 0,
        total_storage_bytes: usedBytes,
        jobs_count: jobs?.length ?? 0,
        last_upload_at: lastUploadAt,
        last_job_at: lastJobAt,
        computed_at: computedAt
      },
      storage: {
        usage: {
          org_id: orgId,
          used_bytes: usedBytes,
          calculated_at: computedAt
        },
        limit: {
          org_id: orgId,
          limit_mb: organization.storage_limit_mb
        },
        remaining: {
          org_id: orgId,
          used_bytes: usedBytes,
          limit_mb: organization.storage_limit_mb,
          remaining_bytes: remainingBytes,
          calculated_at: computedAt
        },
        near_limit: nearLimit
      },
      recent_uploads: recentUploads ?? [],
      jobs: {
        org_id: orgId,
        total: jobs?.length ?? 0,
        by_state: byState,
        recent: jobs ?? [],
        computed_at: computedAt
      },
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

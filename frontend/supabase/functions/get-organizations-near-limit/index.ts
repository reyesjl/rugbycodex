import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthContext } from "../_shared/auth.ts";
import { requireAuthenticated, requirePlatformAdmin } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";
serve(withObservability("get-organizations-near-limit", async (req)=>{
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
    // ------------------------------------------------------------------
    // Load organizations
    // ------------------------------------------------------------------
    const { data: organizations, error: orgError } = await supabase.from("organizations").select("id, owner, slug, name, created_at, storage_limit_mb, bio, visibility, type");
    if (orgError || !organizations) {
      throw orgError;
    }
    // ------------------------------------------------------------------
    // Load aggregated storage usage per org
    // ------------------------------------------------------------------
    const { data: assets, error: assetsError } = await supabase.from("media_assets").select("org_id, file_size_bytes");
    if (assetsError) {
      throw assetsError;
    }
    // Aggregate used bytes by org_id
    const usageByOrg = {};
    for (const asset of assets ?? []){
      const orgId = asset.org_id;
      usageByOrg[orgId] = (usageByOrg[orgId] ?? 0) + Number(asset.file_size_bytes ?? 0);
    }
    // ------------------------------------------------------------------
    // Thresholds
    // ------------------------------------------------------------------
    const WARNING_THRESHOLD = 0.75;
    // ------------------------------------------------------------------
    // Build response
    // ------------------------------------------------------------------
    const results = organizations.map((org)=>{
      const usedBytes = usageByOrg[org.id] ?? 0;
      const limitMb = org.storage_limit_mb;
      const limitBytes = limitMb * 1024 * 1024;
      if (limitBytes === 0) return null;
      const utilizationRatio = usedBytes / limitBytes;
      if (utilizationRatio < WARNING_THRESHOLD) return null;
      return {
        organization: org,
        used_bytes: usedBytes,
        limit_mb: limitMb,
        utilization_ratio: utilizationRatio,
        computed_at: computedAt
      };
    }).filter(Boolean);
    // ------------------------------------------------------------------
    // Response
    // ------------------------------------------------------------------
    return new Response(JSON.stringify(results), {
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

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req)=>{
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }
    const { orgId, fileSizeBytes } = await req.json();
    if (!orgId || !fileSizeBytes || fileSizeBytes <= 0) {
      return new Response("Invalid input", {
        status: 400
      });
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Missing Authorization header", {
        status: 401
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    // Identify caller
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response("Unauthorized", {
        status: 401
      });
    }
    const userId = user.id;
    // Check platform admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    let isAuthorized = profile?.role === "admin";
    // Check org membership if not admin
    if (!isAuthorized) {
      const { data: membership } = await supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
      isAuthorized = !!membership;
    }
    if (!isAuthorized) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: "not_authorized",
        org_id: orgId,
        file_size_bytes: fileSizeBytes,
        remaining_bytes: null,
        limit_bytes: null,
        used_bytes: null
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Fetch org storage limit
    const { data: org, error: orgError } = await supabase.from("organizations").select("storage_limit_mb").eq("id", orgId).single();
    if (orgError || !org) {
      return new Response("Organization not found", {
        status: 404
      });
    }
    const limit_bytes = org.storage_limit_mb * 1024 * 1024;
    // Aggregate current usage
    const { data: usage, error: usageError } = await supabase.from("media_assets").select("file_size_bytes").eq("org_id", orgId);
    if (usageError) {
      return new Response("Failed to calculate usage", {
        status: 500
      });
    }
    const used_bytes = usage.reduce((sum, row)=>sum + Number(row.file_size_bytes), 0);
    // If usage somehow already exceeds limit (bad data, legacy rows), remaining_bytes will be negative.
    // Fix: const remaining_bytes = Math.max(0, limit_bytes - used_bytes);
    const remaining_bytes = limit_bytes - used_bytes;
    const allowed = remaining_bytes >= fileSizeBytes;
    // Success
    return new Response(JSON.stringify({
      allowed,
      reason: allowed ? null : "storage_limit_exceeded",
      org_id: orgId,
      file_size_bytes: fileSizeBytes,
      remaining_bytes,
      limit_bytes,
      used_bytes
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
});

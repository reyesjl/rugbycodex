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
    const filters = await req.json();
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
    // Verify platform admin / moderator
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileError) {
      return new Response("Profile not found", {
        status: 403
      });
    }
    if (![
      "admin",
      "moderator"
    ].includes(profile.role)) {
      return new Response("Forbidden", {
        status: 403
      });
    }
    // Build query
    let query = supabase.from("organization_requests").select(`
        id,
        requester_id,
        requested_name,
        requested_slug,
        requested_type,
        message,
        status,
        reviewed_by,
        reviewed_at,
        review_notes,
        organization_id,
        created_at,
        updated_at,
        requester:profiles!organization_requests_requester_id_fkey (
          id,
          username,
          name,
          role
        ),
        reviewer:profiles!organization_requests_reviewed_by_fkey (
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
      query = query.or(`requested_name.ilike.%${filters.search}%,requested_slug.ilike.%${filters.search}%`);
    }
    const limit = filters?.limit ?? 25;
    const offset = filters?.offset ?? 0;
    query = query.order("created_at", {
      ascending: false
    }).range(offset, offset + limit - 1);
    // Execute
    const { data, error } = await query;
    if (error) {
      console.error(error);
      return new Response("Query failed", {
        status: 500
      });
    }
    return new Response(JSON.stringify(data), {
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

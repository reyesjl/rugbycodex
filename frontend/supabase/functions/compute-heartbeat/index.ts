// supabase/functions/compute-heartbeat/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
serve(async (req)=>{
  // Allow only POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405
    });
  }
  // --- AUTHENTICATION ---
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", {
      status: 401
    });
  }
  const token = authHeader.replace("Bearer ", "").trim();
  const expected = Deno.env.get("ORIN_NANO_SECRET");
  if (!expected || token !== expected) {
    return new Response("Forbidden", {
      status: 403
    });
  }
  // --- PARSE BODY ---
  let body;
  try {
    body = await req.json();
  } catch  {
    return new Response("Invalid JSON", {
      status: 400
    });
  }
  const { name, hostname, cpu_cores, memory_total_mb, gpu_model, cuda_version, jetpack_version, cpu_utilization, memory_used_mb, gpu_utilization, temperature_c, last_error } = body;
  if (!name) {
    return new Response("Missing device name", {
      status: 400
    });
  }
  // --- DB CLIENT (SERVICE ROLE) ---
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  // --- UPSERT HEARTBEAT ---
  const { error } = await supabase.from("compute_devices").upsert({
    name,
    hostname,
    status: "online",
    last_heartbeat_at: new Date().toISOString(),
    cpu_cores,
    memory_total_mb,
    gpu_model,
    cuda_version,
    jetpack_version,
    cpu_utilization,
    memory_used_mb,
    gpu_utilization,
    temperature_c,
    last_error,
    updated_at: new Date().toISOString()
  }, {
    onConflict: "name"
  });
  if (error) {
    console.error("Upsert failed:", error);
    return new Response("Database error", {
      status: 500
    });
  }
  return new Response(JSON.stringify({
    ok: true
  }), {
    headers: {
      "Content-Type": "application/json"
    }
  });
});

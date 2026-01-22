import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { logEvent, withObservability } from '../_shared/observability.ts';
import { getUserRoleFromRequest, requireAuthenticated, requireRole } from '../_shared/roles.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey'
};
serve(withObservability('transcribe-wav-file', async (req, ctx)=>{
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    try {
      const { userId, role } = await getUserRoleFromRequest(req);
      requireAuthenticated(userId);
      requireRole(role, "member");
    } catch (err) {
      const status = (err as any)?.status ?? 403;
      const message = status === 401 ? "Unauthorized" : "Forbidden";
      return new Response(JSON.stringify({
        error: message
      }), {
        status,
        headers: corsHeaders
      });
    }
    // Only accept POST
    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        error: "Method not allowed"
      }), {
        status: 405,
        headers: corsHeaders
      });
    }
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) {
      return new Response(JSON.stringify({
        error: "No file provided"
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([
      arrayBuffer
    ], {
      type: file.type
    });
    // Call OpenAI Whisper API
    const form = new FormData();
    form.append("file", blob, file.name);
    form.append("model", "whisper-1");
    const openaiStart = performance.now();
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`
      },
      body: form
    });
    const openaiDuration = Math.round(performance.now() - openaiStart);
    logEvent({
      severity: 'info',
      event_type: 'metric',
      metric_name: 'api_external_call_latency_ms',
      metric_value: openaiDuration,
      tags: { service: 'openai', function: 'transcribe-wav-file' },
    });
    const data = await response.json();
    return new Response(JSON.stringify({
      transcription: data.text
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    logEvent({
      severity: 'error',
      event_type: 'request_error',
      request_id: ctx.requestId,
      function: 'transcribe-wav-file',
      error_code: 'OPENAI_FAILED',
      error_message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    logEvent({
      severity: 'error',
      event_type: 'metric',
      metric_name: 'api_external_call_errors_total',
      metric_value: 1,
      tags: { service: 'openai', function: 'transcribe-wav-file' },
    });
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}));

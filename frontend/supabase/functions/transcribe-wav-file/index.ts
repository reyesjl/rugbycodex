import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/errors.ts';
import { logEvent, withObservability } from '../_shared/observability.ts';
import { getUserRoleFromRequest, requireAuthenticated, requireRole } from '../_shared/roles.ts';

Deno.serve(withObservability('transcribe-wav-file', async (req, ctx) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }

    console.warn("AUTH CLIENT DEBUG", {
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });

    try {
      const { userId, role } = await getUserRoleFromRequest(req);
      requireAuthenticated(userId);
      requireRole(role, "member");
    } catch (err) {
      const status = (err as any)?.status ?? 403;
      const message = err instanceof Error ? err.message : (status === 401 ? "Unauthorized" : "Forbidden");
      return errorResponse(status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN", message, status);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) {
      return errorResponse("MISSING_REQUIRED_FIELDS", "No file provided", 400);
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
    return jsonResponse({ transcription: data.text }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent({
      severity: 'error',
      event_type: 'request_error',
      request_id: ctx.requestId,
      function: 'transcribe-wav-file',
      error_code: 'OPENAI_FAILED',
      error_message: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    logEvent({
      severity: 'error',
      event_type: 'metric',
      metric_name: 'api_external_call_errors_total',
      metric_value: 1,
      tags: { service: 'openai', function: 'transcribe-wav-file' },
    });
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

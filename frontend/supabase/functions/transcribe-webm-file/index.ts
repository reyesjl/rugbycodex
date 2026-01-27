import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/errors.ts';
import { getAuthContext, getClientBoundToRequest } from '../_shared/auth.ts';
import { getUserRoleFromRequest, requireAuthenticated, requireRole } from '../_shared/roles.ts';
import { logEvent, withObservability } from '../_shared/observability.ts';

Deno.serve(withObservability('transcribe-webm-file', async (req, ctx) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }

    console.warn("AUTH CLIENT DEBUG", {
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });

    const { userId } = await getAuthContext(req);
    try {
      requireAuthenticated(userId);
      const orgId = req.headers.get("x-org-id");
      console.warn("TRANSCRIBE DEBUG: parsed orgId", { orgId });
      console.warn("TRANSCRIBE DEBUG: calling getUserRoleFromRequest()", {
        orgId,
      });
      const supabase = getClientBoundToRequest(req);
      const { role, source } = await getUserRoleFromRequest(req, {
        supabase,
        orgId: orgId ?? undefined,
      });
      console.warn("TRANSCRIBE DEBUG: role resolution result", {
        userId,
        role,
        source,
      });
      console.warn("TRANSCRIBE DEBUG: applying guards", {
        userId,
        role,
        source,
      });
      requireRole(role, "member");
    } catch (err) {
      logEvent({
        severity: 'warn',
        event_type: 'auth_failure',
        request_id: ctx.requestId,
        function: 'transcribe-webm-file',
        error_code: 'AUTH_INVALID_TOKEN',
        error_message: 'Unauthorized',
      });
      const status = (err as any)?.status ?? 403;
      const message = err instanceof Error ? err.message : (status === 401 ? "Unauthorized" : "Forbidden");
      return errorResponse(status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN", message, status);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) {
      return errorResponse("MISSING_REQUIRED_FIELDS", "No file provided", 400);
    }

    // Validate file type.
    // WebM is common on Chromium; iOS/Safari typically records as MP4/AAC (often using .m4a extension).
    const uploadedType = (file.type || '').toLowerCase();
    const uploadedName = (file.name || '').toLowerCase();

    const isWebM = uploadedType.includes('webm') || uploadedName.endsWith('.webm');
    const isMp4 = uploadedType.includes('mp4') || uploadedName.endsWith('.mp4') || uploadedName.endsWith('.m4a');

    if (!isWebM && !isMp4) {
      return errorResponse(
        "INVALID_FILE_TYPE",
        "Invalid file type. Supported: WebM (.webm) and MP4/AAC (.m4a, .mp4).",
        400
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    const fallbackType = isMp4 ? 'audio/mp4' : 'audio/webm';
    const blob = new Blob([arrayBuffer], { type: uploadedType || fallbackType });

    // Call OpenAI Whisper API
    const form = new FormData();

    const fallbackName = isMp4 ? 'audio.m4a' : 'audio.webm';
    form.append('file', blob, uploadedName || fallbackName);
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
      tags: { service: 'openai', function: 'transcribe-webm-file' },
    });
    const data = await response.json();
    return jsonResponse({ text: data.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent({
      severity: 'error',
      event_type: 'request_error',
      request_id: ctx.requestId,
      function: 'transcribe-webm-file',
      error_code: 'OPENAI_FAILED',
      error_message: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    logEvent({
      severity: 'error',
      event_type: 'metric',
      metric_name: 'api_external_call_errors_total',
      metric_value: 1,
      tags: { service: 'openai', function: 'transcribe-webm-file' },
    });
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

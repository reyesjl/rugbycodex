import { supabase } from "@/lib/supabaseClient";
import { activeOrgIdRef } from "@/modules/orgs/stores/activeOrgContext";
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";
import { logEdgeCall } from "@/lib/logger";

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1] & { orgScoped?: boolean };

type LogEvent = {
  severity: "debug" | "info" | "warn" | "error";
  event_type: string;
  request_id?: string;
  function?: string;
  duration_ms?: number;
  metric_name?: string;
  metric_value?: number;
  tags?: Record<string, string | number | boolean | null | undefined>;
  [extra: string]: unknown;
};

function logEvent(event: LogEvent) {
  const payload = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  console.log(JSON.stringify(payload));
}

export function makeRequestId(): string {
  return crypto.randomUUID();
}

export async function invokeEdge(functionName: string, options?: InvokeOptions) {
  const requestId = makeRequestId();
  const start = performance.now();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  const { orgScoped, ...edgeOptions } = options ?? {};
  const baseHeaders = { ...(edgeOptions.headers ?? {}) };
  const hasOrgHeader = Object.keys(baseHeaders).some((header) => header.toLowerCase() === "x-org-id");
  const isDev = import.meta.env?.DEV ?? false;

  let headers = { ...baseHeaders };

  if (orgScoped) {
    const activeOrgId = activeOrgIdRef.value;
    if (!activeOrgId) {
      const message = `Unable to call org-scoped edge function "${functionName}" without an active organization.`;
      if (isDev) {
        console.warn(`[invokeEdge] ${message}`);
      }
      throw new Error(message);
    }
    if (!hasOrgHeader) {
      if (isDev) {
        console.warn(
          `[invokeEdge] org-scoped function "${functionName}" was invoked without an x-org-id header; injecting active organization id "${activeOrgId}".`
        );
      }
      headers = { ...headers, "x-org-id": activeOrgId };
    }
  }

  const finalHeaders = {
    ...headers,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    "x-request-id": requestId,
  };

  const response = await supabase.functions.invoke(functionName, {
    ...edgeOptions,
    headers: finalHeaders,
  });

  const durationMs = Math.round(performance.now() - start);

  // Enhanced error logging following Supabase best practices
  if (response.error) {
    let errorType = "unknown";
    let errorStatus: number | undefined;
    let errorCode: string | undefined;

    if (response.error instanceof FunctionsHttpError) {
      errorType = "http";
      errorStatus = response.error.context.status;
      try {
        const body = await response.error.context.clone().json();
        errorCode = body?.error?.code;
      } catch {
        // Ignore JSON parse errors
      }
    } else if (response.error instanceof FunctionsRelayError) {
      errorType = "relay";
    } else if (response.error instanceof FunctionsFetchError) {
      errorType = "fetch";
    }

    logEvent({
      severity: "error",
      event_type: "client_request",
      request_id: requestId,
      function: functionName,
      duration_ms: durationMs,
      error_type: errorType,
      error_status: errorStatus,
      error_code: errorCode,
      error_message: response.error.message,
    });

    // Log to Axiom
    logEdgeCall(
      functionName,
      requestId,
      durationMs,
      'error',
      {
        error_type: errorType,
        error_status: errorStatus,
        error_code: errorCode,
        error_message: response.error.message,
      }
    );
  } else {
    logEvent({
      severity: "info",
      event_type: "client_request",
      request_id: requestId,
      function: functionName,
      duration_ms: durationMs,
    });

    // Log to Axiom
    logEdgeCall(
      functionName,
      requestId,
      durationMs,
      'success'
    );
  }

  logEvent({
    severity: "info",
    event_type: "metric",
    metric_name: "frontend_request_latency_ms",
    metric_value: durationMs,
    tags: { function: functionName },
  });

  logEvent({
    severity: "info",
    event_type: "metric",
    metric_name: "frontend_requests_total",
    metric_value: 1,
    tags: { function: functionName, status: response.error ? "error" : "ok" },
  });

  return response;
}

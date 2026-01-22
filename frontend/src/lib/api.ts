import { supabase } from "@/lib/supabaseClient";

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

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

  const response = await supabase.functions.invoke(functionName, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      "x-request-id": requestId,
    },
  });

  const durationMs = Math.round(performance.now() - start);

  logEvent({
    severity: response.error ? "error" : "info",
    event_type: "client_request",
    request_id: requestId,
    function: functionName,
    duration_ms: durationMs,
    error: response.error ? String(response.error) : undefined,
  });

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

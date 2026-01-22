export type LogSeverity = "debug" | "info" | "warn" | "error";

type LogEvent = {
  severity: LogSeverity;
  event_type: string;
  request_id?: string;
  trace_id?: string;
  user_id?: string;
  org_id?: string;
  job_id?: string;
  media_id?: string;
  function?: string;
  service?: string;
  duration_ms?: number;
  status?: number;
  error_code?: string;
  error_message?: string;
  stack?: string;
  metric_name?: string;
  metric_value?: number;
  tags?: Record<string, string | number | boolean | null | undefined>;
  [extra: string]: unknown;
};

export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function logEvent(event: LogEvent): void {
  const payload = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  console.log(JSON.stringify(payload));
}

export function withObservability(
  functionName: string,
  handler: (req: Request, ctx: { requestId: string; startTimeMs: number }) => Promise<Response> | Response,
) {
  return async (req: Request): Promise<Response> => {
    const requestId = getRequestId(req);
    const startTimeMs = performance.now();
    const route = new URL(req.url).pathname;

    logEvent({
      severity: "info",
      event_type: "request_start",
      request_id: requestId,
      function: functionName,
      route,
      method: req.method,
    });

    try {
      const response = await handler(req, { requestId, startTimeMs });
      const durationMs = Math.round(performance.now() - startTimeMs);

      logEvent({
        severity: "info",
        event_type: "request_end",
        request_id: requestId,
        function: functionName,
        status: response.status,
        duration_ms: durationMs,
      });

      logEvent({
        severity: "info",
        event_type: "metric",
        metric_name: "api_requests_total",
        metric_value: 1,
        tags: { function: functionName, status: response.status },
      });

      logEvent({
        severity: "info",
        event_type: "metric",
        metric_name: "api_request_latency_ms",
        metric_value: durationMs,
        tags: { function: functionName },
      });

      if (response.status >= 400) {
        logEvent({
          severity: response.status >= 500 ? "error" : "warn",
          event_type: "request_error",
          request_id: requestId,
          function: functionName,
          error_code: `HTTP_${response.status}`,
          error_message: "Request failed",
          status: response.status,
        });

        logEvent({
          severity: response.status >= 500 ? "error" : "warn",
          event_type: "metric",
          metric_name: "api_errors_total",
          metric_value: 1,
          tags: { function: functionName, error_code: `HTTP_${response.status}` },
        });
      }

      return response;
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTimeMs);
      const error = err as { message?: string; stack?: string };

      logEvent({
        severity: "error",
        event_type: "request_error",
        request_id: requestId,
        function: functionName,
        error_code: "UNHANDLED_EXCEPTION",
        error_message: error?.message ?? String(err),
        stack: error?.stack,
        duration_ms: durationMs,
      });

      logEvent({
        severity: "error",
        event_type: "metric",
        metric_name: "api_errors_total",
        metric_value: 1,
        tags: { function: functionName, error_code: "UNHANDLED_EXCEPTION" },
      });

      logEvent({
        severity: "info",
        event_type: "request_end",
        request_id: requestId,
        function: functionName,
        status: 500,
        duration_ms: durationMs,
      });

      throw err;
    }
  };
}

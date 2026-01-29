/**
 * High-level logging utilities for Rugby Codex.
 * Provides convenient methods for logging errors, warnings, and events.
 */

import { axiom, createLogEvent, type LogSeverity, type LogEvent } from './axiom';

/**
 * Log an error with full context
 */
export function logError(
  message: string,
  error?: Error | unknown,
  context: Record<string, unknown> = {}
): void {
  const event = createLogEvent('error', 'frontend_error', {
    message,
    error_message: error instanceof Error ? error.message : String(error),
    error_stack: error instanceof Error ? error.stack : undefined,
    ...context,
  });
  
  axiom.log(event);
  
  // Also log to console for development
  console.error(`[Error] ${message}`, error, context);
}

/**
 * Log a warning
 */
export function logWarning(
  message: string,
  context: Record<string, unknown> = {}
): void {
  const event = createLogEvent('warn', 'frontend_warning', {
    message,
    ...context,
  });
  
  axiom.log(event);
  console.warn(`[Warning] ${message}`, context);
}

/**
 * Log an informational event
 */
export function logInfo(
  message: string,
  context: Record<string, unknown> = {}
): void {
  const event = createLogEvent('info', 'frontend_info', {
    message,
    ...context,
  });
  
  axiom.log(event);
}

/**
 * Log a debug event (only in development)
 */
export function logDebug(
  message: string,
  context: Record<string, unknown> = {}
): void {
  if (import.meta.env.DEV) {
    console.debug(`[Debug] ${message}`, context);
  }
}

/**
 * Log a custom event
 */
export function logEvent(
  severity: LogSeverity,
  eventType: string,
  data: Record<string, unknown> = {}
): void {
  const event = createLogEvent(severity, eventType, data);
  axiom.log(event);
}

/**
 * Log a user action
 */
export function logUserAction(
  action: string,
  data: Record<string, unknown> = {}
): void {
  const event = createLogEvent('info', 'user_action', {
    action,
    ...data,
  });
  
  axiom.log(event);
}

/**
 * Log an edge function call
 */
export function logEdgeCall(
  functionName: string,
  requestId: string,
  durationMs?: number,
  status?: 'success' | 'error',
  context: Record<string, unknown> = {}
): void {
  const event = createLogEvent(
    status === 'error' ? 'error' : 'info',
    'edge_function_call',
    {
      function_name: functionName,
      request_id: requestId,
      duration_ms: durationMs,
      status,
      ...context,
    }
  );
  
  axiom.log(event);
}

/**
 * Log a performance metric
 */
export function logPerformance(
  metric: string,
  value: number,
  unit: string = 'ms',
  context: Record<string, unknown> = {}
): void {
  const event = createLogEvent('info', 'performance_metric', {
    metric_name: metric,
    metric_value: value,
    metric_unit: unit,
    ...context,
  });
  
  axiom.log(event);
}

/**
 * Log a route transition
 */
export function logRouteTransition(
  from: string,
  to: string,
  durationMs?: number
): void {
  const event = createLogEvent('info', 'route_transition', {
    route_from: from,
    route_to: to,
    duration_ms: durationMs,
  });
  
  axiom.log(event);
}

/**
 * Flush all pending logs immediately
 */
export async function flushLogs(): Promise<void> {
  await axiom.flush();
}

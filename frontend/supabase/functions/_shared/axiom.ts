/**
 * Axiom logging client for Supabase Edge Functions.
 * Batches logs and sends them to Axiom for centralized observability.
 */

const AXIOM_API_TOKEN = Deno.env.get('AXIOM_API_TOKEN');
const AXIOM_DATASET = Deno.env.get('AXIOM_DATASET') || 'rugbycodex-logs';
const AXIOM_ENVIRONMENT = Deno.env.get('AXIOM_ENVIRONMENT') || 'production';
const AXIOM_INGEST_URL = `https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`;

const ENABLED = !!AXIOM_API_TOKEN && !!AXIOM_DATASET;

export type LogSeverity = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  timestamp?: string;
  severity: LogSeverity;
  event_type: string;
  request_id?: string;
  function?: string;
  user_id?: string;
  org_id?: string;
  [key: string]: unknown;
}

/**
 * Send a batch of log events to Axiom
 */
export async function sendToAxiom(events: LogEvent[]): Promise<void> {
  if (!ENABLED) {
    console.warn('[Axiom] Not configured (missing AXIOM_API_TOKEN or AXIOM_DATASET), skipping log upload');
    return;
  }

  if (events.length === 0) {
    return;
  }

  // Enrich events with standard fields
  const enrichedEvents = events.map((event) => ({
    timestamp: event.timestamp || new Date().toISOString(),
    environment: AXIOM_ENVIRONMENT,
    layer: 'edge_function',
    runtime: 'deno',
    region: Deno.env.get('SB_REGION') || 'unknown',
    execution_id: Deno.env.get('SB_EXECUTION_ID') || 'unknown',
    ...event,
  }));

  try {
    const response = await fetch(AXIOM_INGEST_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AXIOM_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enrichedEvents),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[Axiom] Failed to send logs:', response.status, text);
    }
  } catch (error) {
    console.error('[Axiom] Error sending logs:', error);
  }
}

/**
 * Create a log event with standard fields
 */
export function createLogEvent(
  severity: LogSeverity,
  eventType: string,
  data: Record<string, unknown> = {}
): LogEvent {
  return {
    severity,
    event_type: eventType,
    ...data,
  };
}

/**
 * Log an error to Axiom
 */
export async function logError(
  message: string,
  error: Error | unknown,
  context: Record<string, unknown> = {}
): Promise<void> {
  const event = createLogEvent('error', 'edge_function_error', {
    message,
    error_message: error instanceof Error ? error.message : String(error),
    error_stack: error instanceof Error ? error.stack : undefined,
    error_name: error instanceof Error ? error.name : 'Error',
    ...context,
  });

  // Log to console immediately
  console.error(`[Error] ${message}`, error, context);

  // Send to Axiom
  await sendToAxiom([event]);
}

/**
 * Add request context to a log event
 */
export function addRequestContext(
  event: LogEvent,
  req: Request,
  ctx: { requestId: string; userId?: string; orgId?: string }
): LogEvent {
  return {
    ...event,
    request_id: ctx.requestId,
    user_id: ctx.userId,
    org_id: ctx.orgId,
    method: req.method,
    url: new URL(req.url).pathname,
  };
}

/**
 * Axiom logging client for Rugby Codex frontend.
 * Batches logs and sends them to Axiom for centralized observability.
 * 
 * Free tier: 500GB/month, 30-day retention
 */

const AXIOM_API_TOKEN = import.meta.env.VITE_AXIOM_API_TOKEN;
const AXIOM_DATASET = import.meta.env.VITE_AXIOM_DATASET;
const AXIOM_ENVIRONMENT = import.meta.env.VITE_AXIOM_ENVIRONMENT || 'development';
const AXIOM_INGEST_URL = `https://api.axiom.co/v1/datasets/${AXIOM_DATASET}/ingest`;

const BATCH_SIZE = 50; // Flush after 50 events
const BATCH_INTERVAL_MS = 10000; // Flush every 10 seconds
const ENABLED = !!AXIOM_API_TOKEN && !!AXIOM_DATASET && AXIOM_ENVIRONMENT === 'production';

export type LogSeverity = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  severity: LogSeverity;
  event_type: string;
  message?: string;
  [key: string]: unknown;
}

class AxiomClient {
  private batch: LogEvent[] = [];
  private flushTimer: number | null = null;
  private isFlushing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Flush on page unload using the async flush (which uses fetch with keepalive)
      // This is better than sendBeacon because it properly sends the Authorization header
      window.addEventListener('beforeunload', () => {
        // Use the async flush - it has keepalive: true which works during unload
        void this.flush();
      });

      // Flush on visibility change (tab hidden)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          void this.flush();
        }
      });
    }
  }

  /**
   * Log an event to Axiom (batched)
   */
  log(event: LogEvent): void {
    // Always log to console in development
    if (AXIOM_ENVIRONMENT === 'development') {
      console.log('[Axiom]', event);
    }

    // Don't send to Axiom if not enabled
    if (!ENABLED) {
      return;
    }

    // Add standard fields
    const enrichedEvent: LogEvent = {
      timestamp: new Date().toISOString(),
      environment: AXIOM_ENVIRONMENT,
      layer: 'frontend',
      ...event,
    };

    this.batch.push(enrichedEvent);

    // Flush if batch is full
    if (this.batch.length >= BATCH_SIZE) {
      this.flush();
    } else if (!this.flushTimer) {
      // Schedule periodic flush
      this.flushTimer = window.setTimeout(() => this.flush(), BATCH_INTERVAL_MS);
    }
  }

  /**
   * Flush logs to Axiom (async)
   */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.batch.length === 0 || this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    const events = [...this.batch];
    this.batch = [];

    try {
      const response = await fetch(AXIOM_INGEST_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AXIOM_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(events),
        keepalive: true, // Important: allows request to complete even if page is closing
      });

      if (!response.ok) {
        console.error('[Axiom] Failed to send logs:', response.status, await response.text());
      }
    } catch (error) {
      console.error('[Axiom] Error sending logs:', error);
    } finally {
      this.isFlushing = false;
    }
  }
}

// Singleton instance
export const axiom = new AxiomClient();

/**
 * Set global context that will be added to all logs
 */
let globalContext: Record<string, unknown> = {};

export function setAxiomContext(context: Record<string, unknown>): void {
  globalContext = { ...globalContext, ...context };
}

export function clearAxiomContext(): void {
  globalContext = {};
}

export function getAxiomContext(): Record<string, unknown> {
  return { ...globalContext };
}

/**
 * Helper to create log events with global context
 */
export function createLogEvent(
  severity: LogSeverity,
  eventType: string,
  data: Record<string, unknown> = {}
): LogEvent {
  return {
    severity,
    event_type: eventType,
    ...globalContext,
    ...data,
  };
}

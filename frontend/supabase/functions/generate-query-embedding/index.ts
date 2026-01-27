import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import OpenAI from "https://esm.sh/openai@4.73.1?target=deno";

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getUserRoleFromRequest, requireAuthenticated, requireRole } from "../_shared/roles.ts";
import { logEvent, withObservability } from "../_shared/observability.ts";

type GenerateQueryEmbeddingBody = {
  query_text?: string;
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

async function generateEmbedding(openai: OpenAI, text: string, requestId?: string): Promise<number[]> {
  let embedding: number[] = [];
  try {
    const start = performance.now();
    const resp = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });

    const duration = Math.round(performance.now() - start);
    logEvent({
      severity: "info",
      event_type: "metric",
      metric_name: "api_external_call_latency_ms",
      metric_value: duration,
      tags: { service: "openai", function: "generate-query-embedding" },
    });

    embedding = resp.data?.[0]?.embedding ?? [];
  } catch (err) {
    logEvent({
      severity: "error",
      event_type: "request_error",
      request_id: requestId,
      function: "generate-query-embedding",
      error_code: "OPENAI_FAILED",
      error_message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    logEvent({
      severity: "error",
      event_type: "metric",
      metric_name: "api_external_call_errors_total",
      metric_value: 1,
      tags: { service: "openai", function: "generate-query-embedding" },
    });
    throw {
      kind: "handled" as const,
      response: errorResponse(
        "OPENAI_EMBEDDING_FAILED",
        "Failed to generate embedding.",
        502,
      ),
    };
  }

  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMS) {
    logEvent({
      severity: "error",
      event_type: "request_error",
      request_id: requestId,
      function: "generate-query-embedding",
      error_code: "EMBEDDING_DIMENSION_MISMATCH",
      error_message: "Embedding dimension mismatch",
      got: embedding?.length,
    });
    throw {
      kind: "handled" as const,
      response: errorResponse(
        "EMBEDDING_DIMENSION_MISMATCH",
        `Expected embedding length ${EMBEDDING_DIMS}.`,
        500,
      ),
    };
  }

  return embedding;
}

Deno.serve(withObservability("generate-query-embedding", async (req, ctx) => {
  // Handle OPTIONS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse(
      "METHOD_NOT_ALLOWED",
      "Only POST is allowed for this endpoint.",
      405,
    );
  }

  try {
    console.warn("AUTH CLIENT DEBUG", {
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });
    try {
      const orgId = req.headers.get("x-org-id") ?? null;
      const { userId, role } = await getUserRoleFromRequest(req, { orgId });
      requireAuthenticated(userId);
      requireRole(role, "member");
    } catch (err) {
      const status = (err as any)?.status ?? 403;
      if (status === 401) {
        return errorResponse("AUTH_REQUIRED", "Authentication required.", 401);
      }
      return errorResponse("FORBIDDEN", "Forbidden", 403);
    }

    const body = (await req.json().catch(() => null)) as GenerateQueryEmbeddingBody | null;

    const queryText = asTrimmedString(body?.query_text);
    if (!queryText) {
      return errorResponse(
        "INVALID_REQUEST",
        "query_text must be a non-empty string.",
        400,
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!apiKey) {
      return errorResponse(
        "OPENAI_API_KEY_MISSING",
        "Missing OPENAI_API_KEY.",
        500,
      );
    }

    const openai = new OpenAI({ apiKey });
    const embedding = await generateEmbedding(openai, queryText, ctx.requestId);
    return jsonResponse({ embedding });
  } catch (err: any) {
    if (err?.kind === "handled" && err?.response instanceof Response) {
      return err.response;
    }

    logEvent({
      severity: "error",
      event_type: "request_error",
      request_id: ctx.requestId,
      function: "generate-query-embedding",
      error_code: "UNEXPECTED_SERVER_ERROR",
      error_message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return errorResponse(
      "UNEXPECTED_SERVER_ERROR",
      "Unexpected server error.",
      500,
    );
  }
}));

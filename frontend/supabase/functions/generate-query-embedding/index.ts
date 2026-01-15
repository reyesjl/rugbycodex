import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import OpenAI from "https://esm.sh/openai@4.73.1?target=deno";

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";

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

async function generateEmbedding(openai: OpenAI, text: string): Promise<number[]> {
  let embedding: number[] = [];
  try {
    const resp = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });

    embedding = resp.data?.[0]?.embedding ?? [];
  } catch (err) {
    console.error("OpenAI embeddings request failed:", err);
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
    console.error("Embedding dimension mismatch:", { got: embedding?.length });
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

Deno.serve(async (req) => {
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
    const embedding = await generateEmbedding(openai, queryText);
    return jsonResponse({ embedding });
  } catch (err: any) {
    if (err?.kind === "handled" && err?.response instanceof Response) {
      return err.response;
    }

    console.error("Unexpected error in generate-query-embedding:", err);
    return errorResponse(
      "UNEXPECTED_SERVER_ERROR",
      "Unexpected server error.",
      500,
    );
  }
});

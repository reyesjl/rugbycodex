import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.73.1?target=deno";

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { withObservability } from "../_shared/observability.ts";

type GenerateEmbeddingBody = {
  narrationId?: string;
  force?: boolean;
  backfill?: boolean;
  limit?: number;
};

type NarrationRow = {
  id: string;
  transcript_raw: string | null;
  transcript_clean: string | null;
  embedding: number[] | null;
};

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return Math.max(min, Math.min(max, i));
}

function pickTranscriptText(row: NarrationRow): string | null {
  const clean = asTrimmedString(row.transcript_clean);
  if (clean) return clean;
  const raw = asTrimmedString(row.transcript_raw);
  if (raw) return raw;
  return null;
}

async function generateAndStoreEmbedding(options: {
  supabaseAdmin: ReturnType<typeof createClient>;
  openai: OpenAI;
  narrationId: string;
  force: boolean;
}): Promise<{ status: "ok" | "skipped" }>
{
  const { supabaseAdmin, openai, narrationId, force } = options;

  const { data: narration, error: narrationError } = await supabaseAdmin
    .from("narrations")
    .select("id, transcript_raw, transcript_clean, embedding")
    .eq("id", narrationId)
    .maybeSingle();

  if (narrationError) {
    console.error("Narration lookup failed:", narrationError);
    throw {
      kind: "handled" as const,
      response: errorResponse(
        "NARRATION_LOOKUP_FAILED",
        "Failed to load narration.",
        500,
      ),
    };
  }

  if (!narration) {
    throw {
      kind: "handled" as const,
      response: errorResponse(
        "NARRATION_NOT_FOUND",
        "Narration not found.",
        404,
      ),
    };
  }

  if (Array.isArray((narration as any).embedding) && !force) {
    return { status: "skipped" };
  }

  const text = pickTranscriptText(narration as NarrationRow);
  if (!text) {
    throw {
      kind: "handled" as const,
      response: errorResponse(
        "NO_TRANSCRIPT",
        "Narration has no transcript text to embed.",
        400,
      ),
    };
  }

  const embedding = await generateEmbedding(openai, text);

  let updateQuery = supabaseAdmin
    .from("narrations")
    .update({ embedding })
    .eq("id", narrationId);

  // If force is false, avoid overwriting an embedding that another worker may have
  // written after we fetched the row.
  if (!force) {
    updateQuery = updateQuery.is("embedding", null);
  }

  const { data: updatedRows, error: updateError } = await updateQuery.select("id");

  if (updateError) {
    console.error("Failed to update narrations.embedding:", updateError);
    throw {
      kind: "handled" as const,
      response: errorResponse(
        "EMBEDDING_UPDATE_FAILED",
        "Failed to store embedding.",
        500,
      ),
    };
  }

  if (!force && (updatedRows?.length ?? 0) === 0) {
    // Another worker likely wrote an embedding between our read and update.
    return { status: "skipped" };
  }

  return { status: "ok" };
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

Deno.serve(withObservability("generate-narration-embedding", async (req) => {
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
    const body = (await req.json().catch(() => null)) as GenerateEmbeddingBody | null;

    const backfill = asBoolean(body?.backfill);
    const force = asBoolean(body?.force);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase env vars.");
      return errorResponse(
        "UNEXPECTED_SERVER_ERROR",
        "Server is not configured.",
        500,
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!apiKey) {
      return errorResponse(
        "OPENAI_API_KEY_MISSING",
        "Missing OPENAI_API_KEY.",
        500,
      );
    }

    const openai = new OpenAI({ apiKey });

    // -------------------------------------------------------------------------
    // Backfill mode: sequentially generate embeddings for missing rows.
    // -------------------------------------------------------------------------
    if (backfill) {
      const limit = clampInt(body?.limit, 25, 1, 200);

      const { data: rows, error: selectError } = await supabaseAdmin
        .from("narrations")
        .select("id, transcript_raw, transcript_clean, embedding")
        .is("embedding", null)
        .limit(limit);

      if (selectError) {
        console.error("Backfill select failed:", selectError);
        return errorResponse(
          "BACKFILL_SELECT_FAILED",
          "Failed to select narrations for backfill.",
          500,
        );
      }

      const narrations = (rows ?? []) as NarrationRow[];

      let processed = 0;
      let skipped = 0;
      let failed = 0;

      for (const n of narrations) {
        try {
          const result = await generateAndStoreEmbedding({
            supabaseAdmin,
            openai,
            narrationId: String(n.id),
            // Backfill should overwrite only if force=true (default false)
            force,
          });

          if (result.status === "skipped") skipped += 1;
          else processed += 1;
        } catch (err: any) {
          failed += 1;
          console.error("Embedding backfill failed for narration:", n?.id, err);
          // Continue to next narration.
        }
      }

      return jsonResponse({ processed, skipped, failed });
    }

    // -------------------------------------------------------------------------
    // Single narration mode
    // -------------------------------------------------------------------------
    const narrationId = asTrimmedString(body?.narrationId);
    if (!narrationId) {
      return errorResponse(
        "NARRATION_ID_REQUIRED",
        "A narrationId must be provided.",
        400,
      );
    }

    const result = await generateAndStoreEmbedding({
      supabaseAdmin,
      openai,
      narrationId,
      force,
    });

    return jsonResponse({ status: result.status });
  } catch (err: any) {
    if (err?.kind === "handled" && err?.response instanceof Response) {
      return err.response;
    }

    console.error("Unexpected error in generate-narration-embedding:", err);
    return errorResponse(
      "UNEXPECTED_SERVER_ERROR",
      "Unexpected server error.",
      500,
    );
  }
}));

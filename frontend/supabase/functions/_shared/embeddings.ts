import { errorResponse } from "./errors.ts";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;

export type MatchSummarySectionInput = {
  set_piece?: string | null;
  territory?: string | null;
  possession?: string | null;
  defence?: string | null;
  kick_battle?: string | null;
  scoring?: string | null;
};

export function buildSegmentInsightEmbeddingText(input: {
  headline: string;
  sentence: string;
  coachScript: string | null;
}): string {
  const parts = [
    `Headline: ${input.headline}`,
    `Summary: ${input.sentence}`,
  ];
  if (input.coachScript) {
    parts.push(`Coach Script: ${input.coachScript}`);
  }
  return parts.join("\n");
}

export function buildMatchIntelligenceEmbeddingText(input: {
  headline: string;
  summary: string[];
  sections?: MatchSummarySectionInput | null;
}): string {
  const parts: string[] = [];
  parts.push(`Match Headline: ${input.headline}`);
  if (input.summary.length > 0) {
    parts.push(`Match Summary:\n- ${input.summary.join("\n- ")}`);
  }
  const sections = input.sections ?? {};
  const sectionEntries: Array<[string, string | null | undefined]> = [
    ["Set Piece", sections.set_piece],
    ["Territory", sections.territory],
    ["Possession", sections.possession],
    ["Defence", sections.defence],
    ["Kick Battle", sections.kick_battle],
    ["Scoring", sections.scoring],
  ];
  for (const [label, value] of sectionEntries) {
    const text = String(value ?? "").trim();
    if (text) {
      parts.push(`${label}: ${text}`);
    }
  }
  return parts.join("\n");
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = String(text ?? "").trim();
  if (!input) {
    throw {
      kind: "handled" as const,
      response: errorResponse("INVALID_REQUEST", "Embedding text must be non-empty.", 400),
    };
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) {
    throw {
      kind: "handled" as const,
      response: errorResponse("OPENAI_API_KEY_MISSING", "Missing OPENAI_API_KEY.", 500),
    };
  }

  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input,
    }),
  });

  if (!resp.ok) {
    throw {
      kind: "handled" as const,
      response: errorResponse("OPENAI_EMBEDDING_FAILED", "Failed to generate embedding.", 502),
    };
  }

  const data = (await resp.json()) as any;
  const embedding = data?.data?.[0]?.embedding ?? [];

  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMS) {
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

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getClientBoundToRequest } from "../_shared/auth.ts";
import { getUserRoleFromRequest, requireAuthenticated, requireRole } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";
import { generateEmbedding } from "../_shared/embeddings.ts";

type AskMatchRagBody = {
  media_asset_id?: string;
  query?: string;
  k_narrations?: number;
  k_segment_insights?: number;
};

type NarrationSearchRow = {
  narration_id: string;
  media_asset_id: string;
  media_asset_segment_id: string | null;
  transcript: string | null;
  score: number | null;
};

type SegmentInsightSearchRow = {
  insight_id: string;
  media_segment_id: string;
  segment_index: number | null;
  start_seconds: number | null;
  end_seconds: number | null;
  insight_headline: string | null;
  insight_sentence: string | null;
  coach_script: string | null;
  narration_count_at_generation: number | null;
  score: number | null;
};

type MatchIntelligenceSearchRow = {
  intelligence_id: string;
  match_headline: string | null;
  match_summary: string[] | null;
  set_piece: string | null;
  territory: string | null;
  possession: string | null;
  defence: string | null;
  kick_battle: string | null;
  scoring: string | null;
  score: number | null;
  generated_at: string | null;
};

type RagPoint = {
  point: string;
  evidence: string[];
};

type RagClip = {
  media_segment_id: string;
  reason: string;
  evidence: string[];
  segment_title?: string | null;
  segment_sentence?: string | null;
  media_asset_thumbnail_path?: string | null;
  segment_index?: number | null;
  start_seconds?: number | null;
  end_seconds?: number | null;
};

function asTrimmedString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampText(text: string, maxChars: number): string {
  const t = String(text ?? "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1).trim()}…`;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function buildEvidenceBundle(input: {
  mediaAssetId: string;
  matchIntelligence: MatchIntelligenceSearchRow | null;
  insights: SegmentInsightSearchRow[];
  narrations: NarrationSearchRow[];
  kNarrations: number;
  kInsights: number;
}): string {
  const lines: string[] = [];
  lines.push("MATCH CONTEXT:");
  lines.push(`- media_asset_id: ${input.mediaAssetId}`);

  if (input.matchIntelligence) {
    const summary = asArray<string>(input.matchIntelligence.match_summary)
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
    lines.push("- match_intelligence:");
    lines.push(`  Headline: ${input.matchIntelligence.match_headline ?? ""}`.trim());
    if (summary.length > 0) {
      lines.push("  Summary bullets:");
      for (const bullet of summary) {
        lines.push(`  - ${bullet}`);
      }
    }
    const sectionEntries: Array<[string, string | null | undefined]> = [
      ["Set Piece", input.matchIntelligence.set_piece],
      ["Territory", input.matchIntelligence.territory],
      ["Possession", input.matchIntelligence.possession],
      ["Defence", input.matchIntelligence.defence],
      ["Kick Battle", input.matchIntelligence.kick_battle],
      ["Scoring", input.matchIntelligence.scoring],
    ];
    for (const [label, value] of sectionEntries) {
      const text = String(value ?? "").trim();
      if (text) {
        lines.push(`  ${label}: ${text}`);
      }
    }
  }

  lines.push(`RETRIEVED SEGMENT INSIGHTS (top ${input.kInsights}):`);
  input.insights.forEach((row, idx) => {
    lines.push(
      `${idx + 1}) [insight:${row.insight_id}] [segment_id:${row.media_segment_id}] ${row.insight_headline ?? ""}`.trim()
    );
    if (row.insight_sentence) {
      lines.push(`   ${row.insight_sentence}`);
    }
    if (row.narration_count_at_generation !== null && row.narration_count_at_generation !== undefined) {
      lines.push(`   narration_count_at_generation: ${row.narration_count_at_generation}`);
    }
    if (row.score !== null && row.score !== undefined) {
      lines.push(`   score: ${row.score}`);
    }
  });

  lines.push(`RETRIEVED NARRATIONS (top ${input.kNarrations}):`);
  input.narrations.forEach((row, idx) => {
    const transcript = clampText(String(row.transcript ?? ""), 420);
    lines.push(
      `${idx + 1}) [narration:${row.narration_id}] [segment_id:${row.media_asset_segment_id ?? "unknown"}]`
    );
    lines.push(`   text: ${transcript}`);
    if (row.score !== null && row.score !== undefined) {
      lines.push(`   score: ${row.score}`);
    }
  });

  return lines.join("\n");
}

function computeConfidence(evidenceCount: number, bestScore: number | null): "low" | "medium" | "high" {
  if (evidenceCount < 5) return "low";
  if (evidenceCount >= 12 && (bestScore ?? 0) >= 0.45) return "high";
  return "medium";
}

Deno.serve(withObservability("ask-match-rag", async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
  }

  try {
    const orgId = req.headers.get("x-org-id") ?? null;
    if (!orgId) {
      return errorResponse("INVALID_REQUEST", "x-org-id header is required.", 400);
    }
    const { userId, role } = await getUserRoleFromRequest(req, { orgId });
    requireAuthenticated(userId);
    requireRole(role, "member");

    const body = (await req.json().catch(() => null)) as AskMatchRagBody | null;

    const mediaAssetId = asTrimmedString(body?.media_asset_id);
    if (!mediaAssetId) {
      return errorResponse("INVALID_REQUEST", "media_asset_id is required.", 400);
    }

    const queryText = asTrimmedString(body?.query);
    if (!queryText) {
      return errorResponse("INVALID_REQUEST", "query must be a non-empty string.", 400);
    }

    const kNarrations = clampNumber(body?.k_narrations, 20, 5, 50);
    const kInsights = clampNumber(body?.k_segment_insights, 10, 3, 30);

    const queryEmbedding = await generateEmbedding(queryText);

    const supabase = getClientBoundToRequest(req);
    const { data: mediaAssetRow, error: mediaAssetError } = await supabase
      .from("media_assets")
      .select("thumbnail_path")
      .eq("id", mediaAssetId)
      .maybeSingle();

    if (mediaAssetError) {
      console.error("ask-match-rag media asset lookup error", mediaAssetError);
    }

    const mediaAssetThumbnailPath = mediaAssetRow?.thumbnail_path ?? null;

    const { data: narrations, error: narrationsError } = await supabase.rpc("search_narrations_hybrid_match", {
      query_text: queryText,
      query_embedding: queryEmbedding,
      match_count: kNarrations,
      org_id_filter: orgId,
      media_asset_id_filter: mediaAssetId,
    });

    if (narrationsError) {
      console.error("ask-match-rag narrations search error", narrationsError);
      return errorResponse("DB_QUERY_FAILED", "Failed to search narrations.", 500);
    }

    const { data: insights, error: insightsError } = await supabase.rpc("search_segment_insights_semantic", {
      org_id_filter: orgId,
      media_asset_id_filter: mediaAssetId,
      query_embedding: queryEmbedding,
      match_count: kInsights,
    });

    if (insightsError) {
      console.error("ask-match-rag segment insights search error", insightsError);
      return errorResponse("DB_QUERY_FAILED", "Failed to search segment insights.", 500);
    }

    const { data: matchIntelligenceRows, error: matchIntelligenceError } = await supabase.rpc(
      "search_match_intelligence_semantic",
      {
        org_id_filter: orgId,
        media_asset_id_filter: mediaAssetId,
        query_embedding: queryEmbedding,
      },
    );

    if (matchIntelligenceError) {
      console.error("ask-match-rag match intelligence search error", matchIntelligenceError);
      return errorResponse("DB_QUERY_FAILED", "Failed to search match intelligence.", 500);
    }

    const narrationRows = (narrations ?? []) as NarrationSearchRow[];
    const insightRows = (insights ?? []) as SegmentInsightSearchRow[];
    const matchIntelligence = (matchIntelligenceRows?.[0] ?? null) as MatchIntelligenceSearchRow | null;

    const evidenceCount = narrationRows.length + insightRows.length;
    const bestScore = Math.max(
      ...narrationRows.map((row) => row.score ?? 0),
      ...insightRows.map((row) => row.score ?? 0),
      matchIntelligence?.score ?? 0,
    );

    if (evidenceCount < 5) {
      return jsonResponse({
        answer: "Not enough coach notes yet to answer confidently.",
        key_points: [],
        recommended_clips: [],
        confidence: "low",
        insufficient_evidence: true,
      });
    }

    const evidenceBundle = buildEvidenceBundle({
      mediaAssetId,
      matchIntelligence,
      insights: insightRows,
      narrations: narrationRows,
      kNarrations,
      kInsights,
    });

    const ragModel = Deno.env.get("OPENAI_RAG_MODEL") ?? "gpt-4.1-mini";
    const systemPrompt =
      "You are RugbyCodex, a rugby performance analyst.\n" +
      "Use ONLY the provided evidence. Do not speculate beyond it.\n" +
      "If evidence is insufficient to answer the question, say so.\n" +
      "Cite evidence IDs when making claims.\n" +
      "Return JSON only with the specified schema.";

    const userPrompt =
      `User question: ${queryText}\n\n` +
      "Evidence bundle:\n" +
      evidenceBundle +
      "\n\nReturn JSON only with this shape:\n" +
      "{\n" +
      '  "answer": "string",\n' +
      '  "key_points": [\n' +
      '    { "point": "string", "evidence": ["narration:<id>", "insight:<id>"] }\n' +
      "  ],\n" +
      '  "recommended_clips": [\n' +
      '    { "media_segment_id": "uuid", "reason": "string", "evidence": ["narration:<id>", "insight:<id>"] }\n' +
      "  ]\n" +
      "}";

    const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!apiKey) {
      return errorResponse("OPENAI_API_KEY_MISSING", "Missing OPENAI_API_KEY.", 500);
    }

    const ragResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ragModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!ragResp.ok) {
      const text = await ragResp.text().catch(() => "");
      console.error("ask-match-rag OpenAI error", text || ragResp.statusText);
      return errorResponse("OPENAI_FAILED", "Failed to generate response.", 502);
    }

    const ragData = (await ragResp.json()) as any;
    const ragContent = ragData?.choices?.[0]?.message?.content ?? "";

    let parsed: any = null;
    try {
      parsed = JSON.parse(ragContent);
    } catch (err) {
      console.error("ask-match-rag invalid JSON response", err);
      return errorResponse("INVALID_AI_RESPONSE", "Failed to parse response.", 500);
    }

    const answer = asTrimmedString(parsed?.answer) ?? "No answer returned.";
    const keyPoints = asArray<RagPoint>(parsed?.key_points)
      .map((item) => ({
        point: asTrimmedString((item as any)?.point) ?? "",
        evidence: asArray<string>((item as any)?.evidence).map((ev) => String(ev ?? "").trim()).filter(Boolean),
      }))
      .filter((item) => item.point);

    const recommendedClips = asArray<RagClip>(parsed?.recommended_clips)
      .map((item) => ({
        media_segment_id: asTrimmedString((item as any)?.media_segment_id) ?? "",
        reason: asTrimmedString((item as any)?.reason) ?? "",
        evidence: asArray<string>((item as any)?.evidence).map((ev) => String(ev ?? "").trim()).filter(Boolean),
        segment_title: asTrimmedString((item as any)?.segment_title) ?? null,
        segment_sentence: asTrimmedString((item as any)?.segment_sentence) ?? null,
        media_asset_thumbnail_path: mediaAssetThumbnailPath,
      }))
      .filter((item) => item.media_segment_id && item.reason);

    const knownSegmentIds = new Set<string>();
    for (const row of narrationRows) {
      if (row.media_asset_segment_id) knownSegmentIds.add(String(row.media_asset_segment_id));
    }
    for (const row of insightRows) {
      if (row.media_segment_id) knownSegmentIds.add(String(row.media_segment_id));
    }

    const filteredClips = recommendedClips.filter((clip) => knownSegmentIds.has(clip.media_segment_id));
    const insightBySegmentId = new Map<string, SegmentInsightSearchRow>();
    for (const row of insightRows) {
      const segmentId = String(row.media_segment_id ?? "").trim();
      if (!segmentId || insightBySegmentId.has(segmentId)) continue;
      insightBySegmentId.set(segmentId, row);
    }

    const clipsWithInsights = filteredClips.map((clip) => {
      const insight = insightBySegmentId.get(clip.media_segment_id);
      return {
        ...clip,
        segment_title: clip.segment_title ?? insight?.insight_headline ?? null,
        segment_sentence: clip.segment_sentence ?? insight?.insight_sentence ?? null,
      };
    });

    let enrichedClips: RagClip[] = clipsWithInsights;
    if (clipsWithInsights.length > 0) {
      const { data: segments, error: segmentsError } = await supabase
        .from("media_asset_segments")
        .select("id, segment_index, start_seconds, end_seconds")
        .eq("media_asset_id", mediaAssetId)
        .in(
          "id",
          clipsWithInsights.map((clip) => clip.media_segment_id),
        );

      if (segmentsError) {
        console.error("ask-match-rag segment lookup error", segmentsError);
      } else {
        const segmentMap = new Map(
          (segments ?? []).map((seg: any) => [
            String(seg.id),
            {
              segment_index: typeof seg.segment_index === "number" ? seg.segment_index : null,
              start_seconds: typeof seg.start_seconds === "number" ? seg.start_seconds : null,
              end_seconds: typeof seg.end_seconds === "number" ? seg.end_seconds : null,
              media_asset_thumbnail_path: mediaAssetThumbnailPath,
            },
          ]),
        );
        enrichedClips = clipsWithInsights.map((clip) => ({
          ...clip,
          ...(segmentMap.get(clip.media_segment_id) ?? {}),
        }));
      }
    }

    const confidence = computeConfidence(evidenceCount, Number.isFinite(bestScore) ? bestScore : null);

    return jsonResponse({
      answer,
      key_points: keyPoints,
      recommended_clips: enrichedClips,
      confidence,
      insufficient_evidence: false,
      evidence: {
        narrations: narrationRows,
        segment_insights: insightRows,
        match_intelligence: matchIntelligence,
      },
    });
  } catch (err) {
    if ((err as any)?.kind === "handled" && (err as any)?.response instanceof Response) {
      return (err as any).response;
    }
    console.error("ask-match-rag unexpected error", err);
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

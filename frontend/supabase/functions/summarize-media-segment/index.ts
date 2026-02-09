import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getAuthContext, getClientBoundToRequest, getServiceRoleClient } from "../_shared/auth.ts";
import { getUserRoleFromRequest, requireAuthenticated, requireOrgRoleSource, requireRole } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

type SegmentRow = {
  id: string;
  media_asset_id: string;
  start_seconds: number | null;
  end_seconds: number | null;
  source_type?: string | null;
};

type NarrationRow = {
  id: string;
  author_id: string | null;
  transcript_raw: string | null;
  media_asset_segment_id: string | null;
  created_at?: string | null;
};

type SummaryContext = {
  segment: {
    media_segment_id: string;
    media_asset_id: string;
    start_seconds: number | null;
    end_seconds: number | null;
    duration_seconds: number | null;
  };
  match: {
    media_asset_id: string;
    file_name: string | null;
    duration_seconds: number | null;
    created_at: string | null;
  };
  narration_count: number;
  narrator_roles: {
    coach: number;
    player: number;
    unknown: number;
  };
  narrations: Array<{
    time_range: string;
    author_role: "coach" | "player" | "unknown";
    text: string;
  }>;
  truncation: {
    narrations_included: number;
    narrations_total: number;
    text_max_chars: number;
  };
};

const DEFAULT_MODEL = "gpt-4.1-mini";
const PROMPT_VERSION = "segment-insight-v1";
const INSIGHT_TEMPERATURE = 0.2;

const SEGMENT_SYSTEM_PROMPT =
  "You are an assistant summarizing a single rugby match segment from team narrations.\n" +
  "Your job is to capture the key observations about this specific clip.\n" +
  "Rules:\n" +
  "- Only use the provided narrations (no speculation).\n" +
  "- Avoid play-by-play or timestamps.\n" +
  "- No tactical recommendations (no 'should').\n" +
  "- Keep a neutral, observational tone.\n" +
  "- If there are only a few narrations, avoid claiming patterns.\n";

const MAX_NARRATIONS = 120;
const MAX_TEXT_CHARS = 420;

type SummaryMode = "state" | "summary";

type InsightResponse = {
  insight_headline: string | null;
  insight_sentence: string | null;
  coach_script: string | null;
};

type SegmentInsightRow = {
  id: string;
  media_segment_id: string;
  state: string;
  insight_headline: string;
  insight_sentence: string;
  coach_script: string | null;
  narration_count_at_generation?: number | null;
  model?: string | null;
  prompt_version?: string | null;
  confidence?: string | null;
};

function mapSegmentInsightRow(row: SegmentInsightRow) {
  return {
    state: String(row?.state ?? "normal"),
    insight_headline: row.insight_headline ?? null,
    insight_sentence: row.insight_sentence ?? null,
    coach_script: row.coach_script ?? null,
  };
}

function computeSegmentStale(currentCount: number, generatedCount: number | null | undefined): boolean {
  const base = Number.isFinite(Number(generatedCount)) ? Math.max(0, Number(generatedCount)) : 0;
  const threshold = Math.max(1, Math.ceil(base * 0.4));
  return currentCount - base >= threshold;
}

function normalizeRole(role: unknown): string {
  return String(role ?? "").trim().toLowerCase();
}

function authorRoleToCoachPlayer(role: unknown): "coach" | "player" | "unknown" {
  const r = normalizeRole(role);
  if (!r) return "unknown";
  if (r === "coach") return "coach";
  if (r === "owner" || r === "manager" || r === "staff" || r === "admin") return "coach";
  if (r === "member" || r === "player") return "player";
  return "player";
}

function clampText(text: string, maxChars: number): string {
  const t = String(text ?? "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1).trim()}…`;
}

function normalizeInsightText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function formatTime(seconds: number | null | undefined): string {
  const s = Math.max(0, Number(seconds ?? 0));
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function makeTimeRange(startSeconds: number | null | undefined, endSeconds: number | null | undefined): string {
  const start = formatTime(startSeconds);
  const end = formatTime(endSeconds);
  return `${start}-${end}`;
}

async function callOpenAI(
  context: SummaryContext
): Promise<{ response: InsightResponse; model: string }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }
  
  const model = Deno.env.get("OPENAI_SUMMARY_MODEL") ?? DEFAULT_MODEL;
  
  const systemPrompt =
    SEGMENT_SYSTEM_PROMPT +
    "OUTPUT FORMAT (strict JSON):\n" +
    "{\n" +
    '  "insight_headline": "3-6 word headline",\n' +
    '  "insight_sentence": "One sentence insight",\n' +
    '  "coach_script": "2-3 sentence spoken script for a coach voiceover"\n' +
    "}\n" +
    "Keep the insight_sentence to a single sentence.";
  
  const body = {
    model,
    temperature: INSIGHT_TEMPERATURE,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Summarize the following segment context. Only use the provided narrations.\n\n" +
          JSON.stringify(context),
      },
    ],
  };
  
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OpenAI request failed (${resp.status}): ${text || resp.statusText}`);
  }
  
  const data = (await resp.json()) as any;
  const content = data?.choices?.[0]?.message?.content ?? "";
  let parsed: any = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = null;
  }
  const response: InsightResponse = {
    insight_headline: normalizeInsightText(parsed?.insight_headline),
    insight_sentence: normalizeInsightText(parsed?.insight_sentence),
    coach_script: normalizeInsightText(parsed?.coach_script),
  };
  return { response, model };
}

Deno.serve(withObservability("summarize-media-segment", async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  
  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
    }
    
    const { userId } = await getAuthContext(req);
    try {
      requireAuthenticated(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unauthorized";
      return errorResponse("AUTH_REQUIRED", message, 401);
    }
    
    let body: any;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_REQUEST", "Invalid JSON body", 400);
    }
    
    const mediaSegmentId = String(body?.media_segment_id ?? body?.mediaSegmentId ?? "").trim();
    if (!mediaSegmentId) {
      return errorResponse("MISSING_REQUIRED_FIELDS", "media_segment_id is required", 400);
    }
    
    const rawMode = String(body?.mode ?? "summary").trim().toLowerCase();
    const mode: SummaryMode = rawMode === "state" ? "state" : "summary";
    const forceRefresh = Boolean(body?.force_refresh ?? body?.forceRefresh);
    
    const supabase = getClientBoundToRequest(req);
    const serviceRoleClient = getServiceRoleClient();
    
    const { data: segment, error: segmentError } = await supabase
      .from("media_asset_segments")
      .select("id, media_asset_id, start_seconds, end_seconds, source_type")
      .eq("id", mediaSegmentId)
      .maybeSingle();
    
    if (segmentError) {
      console.error("summarize_media_segment segment error", segmentError);
      return errorResponse("DB_QUERY_FAILED", "Failed to load media segment", 500);
    }
    
    if (!segment) {
      return errorResponse("NOT_FOUND", "Media segment not found", 404);
    }
    
    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .select("id, org_id, file_name, duration_seconds, created_at")
      .eq("id", (segment as SegmentRow).media_asset_id)
      .maybeSingle();
    
    if (assetError) {
      console.error("summarize_media_segment media_assets error", assetError);
      return errorResponse("DB_QUERY_FAILED", "Failed to load media asset", 500);
    }
    
    if (!asset) {
      return errorResponse("NOT_FOUND", "Media asset not found", 404);
    }
    
    const orgId = String((asset as any).org_id ?? "").trim();
    if (!orgId) {
      return errorResponse("UNEXPECTED_SERVER_ERROR", "Media asset missing org_id", 500);
    }
    
    try {
      const { role, source } = await getUserRoleFromRequest(req, { supabase, orgId });
      requireOrgRoleSource(source);
      requireRole(role, "member");
    } catch (err) {
      console.error("summarize_media_segment role guard error", err);
      const message = err instanceof Error ? err.message : "Forbidden";
      return errorResponse("FORBIDDEN", message, 403);
    }
    
    const { data: narrationsAll, error: narrationError } = await supabase
      .from("narrations")
      .select("id, author_id, transcript_raw, media_asset_segment_id, created_at")
      .eq("media_asset_segment_id", mediaSegmentId);
    
    if (narrationError) {
      console.error("summarize_media_segment narrations error", narrationError);
      return errorResponse("DB_QUERY_FAILED", "Failed to load narrations", 500);
    }
    
    const narrationRows = (narrationsAll ?? []) as NarrationRow[];
    
    const authorIds = Array.from(
      new Set(
        narrationRows
          .map((n) => (n?.author_id ? String(n.author_id) : ""))
          .filter(Boolean)
      )
    );
    
    const authorRoleMap = new Map<string, string>();
    if (authorIds.length) {
      const { data: memberRows, error: memberErr } = await supabase
        .from("org_members")
        .select("user_id, role")
        .eq("org_id", orgId)
        .in("user_id", authorIds);
      
      if (memberErr) {
        console.error("summarize_media_segment author role lookup error", memberErr);
      } else {
        for (const row of (memberRows ?? []) as any[]) {
          const uid = String(row?.user_id ?? "");
          const role = String(row?.role ?? "");
          if (uid) authorRoleMap.set(uid, role);
        }
      }
    }
    
    const narrationSorted = narrationRows
      .map((row) => ({
        row,
        createdAt: String(row?.created_at ?? ""),
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    
    const narrationsLimited = narrationSorted.slice(0, MAX_NARRATIONS);
    
    const narratorRolesCount = { coach: 0, player: 0, unknown: 0 } as SummaryContext["narrator_roles"];
    
    const segmentStart = (segment as SegmentRow).start_seconds ?? null;
    const segmentEnd = (segment as SegmentRow).end_seconds ?? null;
    const segmentDuration =
      typeof segmentStart === "number" && typeof segmentEnd === "number"
        ? Math.max(0, segmentEnd - segmentStart)
        : null;
    
    const narrationsForContext: SummaryContext["narrations"] = narrationsLimited
      .map((item) => {
        const n = item.row;
        const authorId = n?.author_id ? String(n.author_id) : "";
        const rawRole = authorId ? authorRoleMap.get(authorId) : "";
        const author_role = authorRoleToCoachPlayer(rawRole);
        narratorRolesCount[author_role] += 1;
        
        const text = clampText(String(n?.transcript_raw ?? "").trim(), MAX_TEXT_CHARS);
        
        return {
          time_range: makeTimeRange(segmentStart, segmentEnd),
          author_role,
          text,
        };
      })
      .filter((n) => n.text.length > 0);
    
    const context: SummaryContext = {
      segment: {
        media_segment_id: String((segment as SegmentRow).id),
        media_asset_id: String((segment as SegmentRow).media_asset_id),
        start_seconds: segmentStart,
        end_seconds: segmentEnd,
        duration_seconds: segmentDuration,
      },
      match: {
        media_asset_id: String((asset as any).id),
        file_name: (asset as any).file_name ?? null,
        duration_seconds: typeof (asset as any).duration_seconds === "number" ? (asset as any).duration_seconds : null,
        created_at: (asset as any).created_at ? String((asset as any).created_at) : null,
      },
      narration_count: narrationRows.length,
      narrator_roles: narratorRolesCount,
      narrations: narrationsForContext,
      truncation: {
        narrations_included: narrationsLimited.length,
        narrations_total: narrationRows.length,
        text_max_chars: MAX_TEXT_CHARS,
      },
    };
    
    if (context.narration_count === 0) {
      return jsonResponse({ state: "empty" });
    }
    
    const state = "normal" as const;
    
    if (mode === "state") {
      return jsonResponse({ state });
    }

    let existingInsight: SegmentInsightRow | null = null;
    {
      const { data: insightRow, error: insightError } = await supabase
        .from("segment_insights")
        .select("id, media_segment_id, state, insight_headline, insight_sentence, coach_script, narration_count_at_generation")
        .eq("media_segment_id", mediaSegmentId)
        .eq("is_active", true)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (insightError) {
        console.error("summarize_media_segment segment_insights error", insightError);
        return errorResponse("DB_QUERY_FAILED", "Failed to load segment insights", 500);
      }

      if (insightRow) {
        existingInsight = insightRow as SegmentInsightRow;
      }
    }

    if (existingInsight && !forceRefresh) {
      const narrationCountCurrent = context.narration_count;
      const narrationCountAtGeneration = existingInsight.narration_count_at_generation ?? null;
      const isStale = computeSegmentStale(narrationCountCurrent, narrationCountAtGeneration);
      return jsonResponse({
        ...mapSegmentInsightRow(existingInsight),
        narration_count_at_generation: narrationCountAtGeneration,
        narration_count_current: narrationCountCurrent,
        is_stale: isStale,
      });
    }

    const { response, model } = await callOpenAI(context);

    if (!response.insight_headline || !response.insight_sentence) {
      return errorResponse("INVALID_AI_RESPONSE", "Segment insight missing required fields.", 500);
    }

    const payload = {
      media_segment_id: mediaSegmentId,
      state,
      insight_headline: response.insight_headline,
      insight_sentence: response.insight_sentence,
      coach_script: response.coach_script,
      confidence: null,
      model,
      prompt_version: PROMPT_VERSION,
      narration_count_at_generation: context.narration_count,
      is_active: true,
      generated_at: new Date().toISOString(),
    };

    let savedRow: SegmentInsightRow | null = null;
    if (existingInsight) {
      const { data: updated, error: updateError } = await serviceRoleClient
        .from("segment_insights")
        .update(payload)
        .eq("id", existingInsight.id)
        .select("id, media_segment_id, state, insight_headline, insight_sentence, coach_script, narration_count_at_generation")
        .maybeSingle();

      if (updateError) {
        console.error("summarize_media_segment segment_insights update error", updateError);
        return errorResponse("DB_QUERY_FAILED", "Failed to update segment insights", 500);
      }

      savedRow = (updated ?? existingInsight) as SegmentInsightRow;
    } else {
      const { data: inserted, error: insertError } = await serviceRoleClient
        .from("segment_insights")
        .insert(payload)
        .select("id, media_segment_id, state, insight_headline, insight_sentence, coach_script, narration_count_at_generation")
        .maybeSingle();

      if (insertError) {
        console.error("summarize_media_segment segment_insights insert error", insertError);
        return errorResponse("DB_QUERY_FAILED", "Failed to save segment insights", 500);
      }

      savedRow = (inserted ?? payload) as SegmentInsightRow;
    }

    return jsonResponse({
      ...mapSegmentInsightRow(savedRow),
      narration_count_at_generation: savedRow?.narration_count_at_generation ?? context.narration_count,
      narration_count_current: context.narration_count,
      is_stale: false,
    });
  } catch (err) {
    console.error("summarize_media_segment unexpected error", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
}));

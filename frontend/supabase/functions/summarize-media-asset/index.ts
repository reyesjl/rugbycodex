import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { corsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";
import { getAuthContext, getClientBoundToRequest } from "../_shared/auth.ts";

type SegmentRow = {
  id: string;
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
  match: {
    media_asset_id: string;
    title: string | null;
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

const ALLOWED_ROLES = new Set(["owner", "manager", "staff"]);

const DEFAULT_MODEL = "gpt-4o-mini";

const MAX_NARRATIONS = 220;
const MAX_TEXT_CHARS = 420;

function normalizeRole(role: unknown): string {
  return String(role ?? "").trim().toLowerCase();
}

function authorRoleToCoachPlayer(role: unknown): "coach" | "player" | "unknown" {
  const r = normalizeRole(role);
  if (!r) return "unknown";
  if (r === "coach") return "coach";
  // Treat staff-like org roles as "coach" for summarization buckets.
  if (r === "owner" || r === "manager" || r === "staff" || r === "admin") return "coach";
  if (r === "member" || r === "player") return "player";
  return "player";
}

function clampText(text: string, maxChars: number): string {
  const t = String(text ?? "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1).trim()}…`;
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
  // Use an en dash to match UI styles.
  return `${start}–${end}`;
}

function asBulletsFromText(raw: unknown): string[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];

  // Prefer parsing JSON if the model returned it.
  try {
    const parsed = JSON.parse(text) as { bullets?: unknown };
    if (Array.isArray(parsed?.bullets)) {
      return parsed.bullets.map((b) => String(b ?? "").trim()).filter(Boolean);
    }
  } catch {
    // ignore
  }

  // Fallback: treat lines starting with '-' or '•' as bullets.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines
    .map((l) => l.replace(/^[-*•]\s+/, "").trim())
    .filter(Boolean);
  return bullets.length ? bullets : [text];
}

function shapeBullets(input: string[]): string[] {
  const cleaned = input
    .map((b) => String(b ?? "").replace(/^[-*•]\s+/, "").trim())
    .filter(Boolean);

  // De-dupe while preserving order.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const b of cleaned) {
    const key = b.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(b);
  }

  return unique.slice(0, 5);
}

function clampBullet(b: string): string {
  const maxChars = 240;
  const t = String(b ?? "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1).trim()}…`;
}

async function callOpenAI(
  context: SummaryContext,
  options?: { forceExactly3?: boolean }
): Promise<{ bullets: string[]; model: string }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const model = Deno.env.get("OPENAI_SUMMARY_MODEL") ?? DEFAULT_MODEL;

  const bulletRule = options?.forceExactly3
    ? "- Return exactly 3 concise bullet points.\\n"
    : "- Return 3 to 5 concise bullet points.\\n";

const systemPrompt =
  "You are an assistant extracting patterns from team match-review narrations.\n" +
  "Your job is to identify recurring themes, patterns, or consistent issues the team has noticed across the match.\n" +
  "Write in direct, practical rugby language, as if summarizing coach and player comments in a review session.\n" +
  "Avoid academic, report-style phrasing.\n" +
  "Rules:\n" +
  "- Focus on patterns and repetition, not individual plays or sequences.\n" +
  "- Do NOT list play-by-play, timestamps, or chronological events.\n" +
  "- Do NOT describe single isolated moments unless they are clearly emphasized multiple times.\n" +
  "- Summarize what keeps showing up or being noticed, not what happened once.\n" +
  "- Avoid speculation; only reflect what is explicitly present in the narrations.\n" +
  "- Avoid tactical recommendations or prescriptions (no 'should', no strategy, no fixes).\n" +
  "- Neutral, observational tone.\n" +
  "- Reflect team observations, not an 'AI opinion'.\n" +
  bulletRule +
  "Output must be strict JSON with shape: { \"bullets\": string[] }.";

  const body = {
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          "Summarize the following match-review context. Only use the provided narrations.\n\n" +
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

  const bullets = shapeBullets(asBulletsFromText(content)).map(clampBullet);
  return { bullets, model };
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const { userId } = await getAuthContext(req);
    if (!userId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const mediaAssetId = String(body?.media_asset_id ?? body?.mediaAssetId ?? "").trim();
    if (!mediaAssetId) {
      return jsonResponse({ error: "media_asset_id is required" }, 400);
    }

    const supabase = getClientBoundToRequest(req);

    // Fetch media asset (and org scope)
    const { data: asset, error: assetError } = await supabase
      .from("media_assets")
      .select("id, org_id, file_name, duration_seconds, created_at")
      .eq("id", mediaAssetId)
      .maybeSingle();

    if (assetError) {
      console.error("summarize_media_asset media_assets error", assetError);
      return jsonResponse({ error: "Failed to load media asset" }, 500);
    }

    if (!asset) {
      return jsonResponse({ error: "Media asset not found" }, 404);
    }

    const orgId = String((asset as any).org_id ?? "").trim();
    if (!orgId) {
      return jsonResponse({ error: "Media asset missing org_id" }, 500);
    }

    // Verify caller membership role in org_members
    const { data: membership, error: membershipError } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      console.error("summarize_media_asset org_members error", membershipError);
      // If RLS blocks, treat as forbidden rather than leaking existence.
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const callerRole = normalizeRole((membership as any)?.role);
    if (!callerRole || !ALLOWED_ROLES.has(callerRole)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    // Load segments to derive time ranges
    const { data: segRows, error: segError } = await supabase
      .from("media_asset_segments")
      .select("id, start_seconds, end_seconds, source_type")
      .eq("media_asset_id", mediaAssetId);

    if (segError) {
      console.error("summarize_media_asset segments error", segError);
      return jsonResponse({ error: "Failed to load segments" }, 500);
    }

    const segments = (segRows ?? []) as SegmentRow[];
    const segmentById = new Map<string, SegmentRow>();
    for (const s of segments) {
      if (s?.id) segmentById.set(String(s.id), s);
    }

    // Fetch narrations for the asset by joining through media_asset_segments.
    // This avoids relying on a redundant media_asset_id column on narrations.
    let narrationsAll: NarrationRow[] = [];
    {
      const joined = await supabase
        .from("narrations")
        .select(
          "id, author_id, transcript_raw, media_asset_segment_id, created_at, media_asset_segments!inner(id, media_asset_id, start_seconds, end_seconds)"
        )
        .eq("media_asset_segments.media_asset_id", mediaAssetId);

      if (!joined.error) {
        narrationsAll = (joined.data ?? []) as NarrationRow[];
      } else {
        // Fallback: if the relationship name differs or join isn't available, use media_asset_id filter.
        // Still safe due to org-scoped RLS on narrations.
        console.warn("summarize_media_asset narrations join failed; falling back", joined.error);
        const fallback = await supabase
          .from("narrations")
          .select("id, author_id, transcript_raw, media_asset_segment_id, created_at")
          .eq("media_asset_id", mediaAssetId);

        if (fallback.error) {
          console.error("summarize_media_asset narrations error", fallback.error);
          return jsonResponse({ error: "Failed to load narrations" }, 500);
        }
        narrationsAll = (fallback.data ?? []) as NarrationRow[];
      }
    }

    // Collect author roles (best effort)
    const authorIds = Array.from(
      new Set(
        narrationsAll
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
        // Don't fail summary for missing author roles; keep unknown.
        console.error("summarize_media_asset author role lookup error", memberErr);
      } else {
        for (const row of (memberRows ?? []) as any[]) {
          const uid = String(row?.user_id ?? "");
          const role = String(row?.role ?? "");
          if (uid) authorRoleMap.set(uid, role);
        }
      }
    }

    // Derive an ordering key from segment start_seconds.
    const withSortKey = narrationsAll.map((n) => {
      const segId = String(n?.media_asset_segment_id ?? "");
      const seg = segId ? segmentById.get(segId) : undefined;
      const segStart = seg?.start_seconds ?? null;
      const segEnd = seg?.end_seconds ?? null;

      const startSeconds = segStart ?? 0;
      const endSeconds = segEnd ?? startSeconds;

      const sortKey = Number(startSeconds ?? 0);
      const createdAt = String((n as any)?.created_at ?? "");
      return {
        row: n,
        sortKey,
        createdAt,
        startSeconds: Number(startSeconds ?? 0),
        endSeconds: Number(endSeconds ?? 0),
      };
    });

    withSortKey.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      // Stable-ish secondary sort
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });

    const narrationsLimited = withSortKey.slice(0, MAX_NARRATIONS);

    const narratorRolesCount = { coach: 0, player: 0, unknown: 0 } as SummaryContext["narrator_roles"];

    const narrationsForContext: SummaryContext["narrations"] = narrationsLimited
      .map((item) => {
        const n = item.row;
        const authorId = n?.author_id ? String(n.author_id) : "";
        const rawRole = authorId ? authorRoleMap.get(authorId) : "";
        const author_role = authorRoleToCoachPlayer(rawRole);
        narratorRolesCount[author_role] += 1;

        const text = clampText(String(n?.transcript_raw ?? "").trim(), MAX_TEXT_CHARS);

        return {
          time_range: makeTimeRange(item.startSeconds, item.endSeconds),
          author_role,
          text,
        };
      })
      .filter((n) => n.text.length > 0);

    const context: SummaryContext = {
      match: {
        media_asset_id: String((asset as any).id),
        title: null,
        file_name: (asset as any).file_name ?? null,
        duration_seconds: typeof (asset as any).duration_seconds === "number" ? (asset as any).duration_seconds : null,
        created_at: (asset as any).created_at ? String((asset as any).created_at) : null,
      },
      narration_count: narrationsAll.length,
      narrator_roles: narratorRolesCount,
      narrations: narrationsForContext,
      truncation: {
        narrations_included: narrationsLimited.length,
        narrations_total: narrationsAll.length,
        text_max_chars: MAX_TEXT_CHARS,
      },
    };

    // If there are no narrations, return an empty summary (UI can hide block).
    if (context.narrations.length === 0) {
      return jsonResponse({
        media_asset_id: mediaAssetId,
        org_id: orgId,
        bullets: [],
        narration_count: context.narration_count,
        model: null,
        generated_at: new Date().toISOString(),
      });
    }

    // Primary attempt.
    let { bullets, model } = await callOpenAI(context);

    // If we didn't get enough bullets, do a single stricter retry.
    if (bullets.length > 0 && bullets.length < 3) {
      try {
        const retry = await callOpenAI(context, { forceExactly3: true });
        if (retry.bullets.length >= bullets.length) {
          bullets = retry.bullets;
          model = retry.model;
        }
      } catch {
        // ignore retry failure
      }
    }

    return jsonResponse({
      media_asset_id: mediaAssetId,
      org_id: orgId,
      bullets,
      narration_count: context.narration_count,
      model,
      generated_at: new Date().toISOString(),
      truncation: context.truncation,
    });
  } catch (err) {
    console.error("summarize_media_asset unexpected error", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

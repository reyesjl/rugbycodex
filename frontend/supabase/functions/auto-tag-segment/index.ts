import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getAuthContext, getClientBoundToRequest, getServiceRoleClient } from "../_shared/auth.ts";
import { allowAdminBypass, getUserRoleFromRequest, requireAuthenticated, requireOrgRoleSource, requireRole } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

type AutoTagRequest = {
  narration_id?: string;
  narrationId?: string;
  segment_id?: string;
  segmentId?: string;
  force?: boolean;
};

type NarrationRow = {
  id: string;
  media_asset_segment_id: string | null;
  transcript_raw: string | null;
  transcript_clean: string | null;
  created_at: string | null;
  author_id: string | null;
};

type SegmentTagSuggestionRow = {
  id: string;
  segment_id: string;
  tag_key: string;
  tag_type: string;
  status: string;
  source: string;
  suggested_by: string;
  decided_by: string | null;
  suggested_at: string | null;
  decided_at: string | null;
  narration_id: string | null;
  tagged_profile_id: string | null;
};

type OrgMemberRow = {
  user_id: string;
  role: string | null;
  profiles: {
    id: string;
    username: string | null;
    name: string | null;
  } | null;
};

type TagCandidateResponse = {
  action_tags?: string[];
  context_tags?: string[];
  identity_tags?: string[];
};

const SET_PIECE_TAGS = ["scrum", "lineout", "kickoff", "restart"];
const ACTION_TAGS = ["carry", "pass", "kick", "tackle", "breakdown", "maul"];
const CONTEXT_TAGS = ["exit", "counter_attack", "transition", "broken_play"];
const ALL_CONTEXT_TAGS = [...SET_PIECE_TAGS, ...CONTEXT_TAGS];

const DEFAULT_MODEL = "gpt-4.1-mini";
const TAGGING_TEMPERATURE = 0.2;
const MAX_TAGS_PER_TYPE = 5;
const MAX_NARRATIONS = 80;
const MAX_TEXT_CHARS = 420;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}


function clampText(text: string, maxChars: number): string {
  const t = String(text ?? "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1).trim()}…`;
}

function displayMemberName(member: OrgMemberRow): string {
  const name = member.profiles?.name?.trim();
  if (name) return name;
  const username = member.profiles?.username?.trim();
  return username ?? "";
}

function normalizeCandidate(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeTagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function buildLookup(values: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (!map.has(key)) {
      map.set(key, value);
    }
  }
  return map;
}

async function callOpenAI(payload: Record<string, unknown>): Promise<TagCandidateResponse> {
  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  const model = Deno.env.get("OPENAI_TAGGING_MODEL")
    ?? Deno.env.get("OPENAI_SUMMARY_MODEL")
    ?? DEFAULT_MODEL;

const systemPrompt =
  "You are tagging a rugby match segment using ONLY the provided tag lists and identity candidates.\n" +
  "\n" +
  "RUGBY INTERPRETATION RULE:\n" +
  "- Always interpret narration using rugby tactical meaning first, not literal English.\n" +
  "- Examples: lifting→lineout, jackal→breakdown steal, exit→territory clearance, fold→defensive realignment, pillar→ruck defence, pod→forward structure.\n" +
  "\n" +
  "SET PIECE INFERENCE:\n" +
  "- Infer set piece context from structure, even if not named.\n" +
  "- Lineout signals include: lifting, jumper, throw, hooker throw, front/middle/back lift, 4-7 man setup, overthrow, underthrow.\n" +
  "- If multiple lineout signals appear, treat as clear lineout evidence.\n" +
  "\n" +
  "TAGGING RULES:\n" +
  "- Use ONLY tag strings from the provided allowed tag lists.\n" +
  "- Tag only when clearly supported by narration or strong rugby structure.\n" +
  "- Prefer fewer correct tags over more uncertain tags.\n" +
  "- Never invent tags. Never repeat tags. Never include existing or suggested tags.\n" +
  "- Max 5 tags per category. If unsure, return empty arrays.\n" +
  "\n" +
  "IDENTITY RULES:\n" +
  "- Only tag identity if narration clearly matches a provided identity candidate name.\n" +
  "- Never guess identity. If ambiguous, do not tag.\n" +
  "\n" +
  "OUTPUT:\n" +
  "- Return strict JSON only. No text. No explanations.\n" +
  '{ "action_tags": [], "context_tags": [], "identity_tags": [] }';

  const body = {
    model,
    temperature: TAGGING_TEMPERATURE,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(payload) },
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
  try {
    return JSON.parse(content) as TagCandidateResponse;
  } catch {
    return {};
  }
}

Deno.serve(withObservability("auto-tag-segment", async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
  }

  const body = (await req.json().catch(() => null)) as AutoTagRequest | null;
  const narrationId = asTrimmedString(body?.narration_id ?? body?.narrationId);
  const segmentIdInput = asTrimmedString(body?.segment_id ?? body?.segmentId);
  const force = body?.force === true;

  if (!narrationId && !segmentIdInput) {
    return errorResponse("INVALID_REQUEST_BODY", "narration_id or segment_id is required.", 400);
  }

  const auth = await getAuthContext(req);
  requireAuthenticated(auth.userId);

  const supabaseAdmin = getServiceRoleClient();
  const supabase = getClientBoundToRequest(req);

  let segmentId = segmentIdInput ?? null;
  if (narrationId) {
    const { data, error } = await supabaseAdmin
      .from("narrations")
      .select("id, media_asset_segment_id, transcript_raw, transcript_clean, created_at, author_id")
      .eq("id", narrationId)
      .maybeSingle();

    if (error) {
      return errorResponse("NARRATION_LOOKUP_FAILED", "Failed to load narration.", 500);
    }
    if (!data) {
      return errorResponse("NARRATION_NOT_FOUND", "Narration not found.", 404);
    }
    const narration = data as NarrationRow;
    if (!segmentId) {
      segmentId = narration.media_asset_segment_id ?? null;
    }
  }
  if (!segmentId) {
    return errorResponse("INVALID_REQUEST_BODY", "Segment id could not be resolved.", 400);
  }

  const { data: segment, error: segmentError } = await supabaseAdmin
    .from("media_asset_segments")
    .select("id, media_asset_id, start_seconds, end_seconds, media_assets (id, org_id, file_name, duration_seconds, created_at)")
    .eq("id", segmentId)
    .maybeSingle();

  if (segmentError) {
    return errorResponse("DB_QUERY_FAILED", "Failed to load segment.", 500);
  }
  if (!segment || !segment.media_assets) {
    return errorResponse("NOT_FOUND", "Segment not found.", 404);
  }

  const orgId = segment.media_assets.org_id ?? null;
  if (!orgId) {
    return errorResponse("ORG_LOOKUP_FAILED", "Organization not found for segment.", 404);
  }

  const { role, source } = await getUserRoleFromRequest(req, {
    supabase,
    orgId,
  });
  allowAdminBypass(auth.isAdmin, () => {
    requireOrgRoleSource(source);
    requireRole(role, "staff");
  });

  if (force) {
    const { error: clearError } = await supabaseAdmin
      .from("segment_tag_suggestions")
      .delete()
      .eq("segment_id", segmentId)
      .eq("status", "pending");
    if (clearError) {
      return errorResponse("DB_QUERY_FAILED", "Failed to clear pending tag suggestions.", 500);
    }
  }

  const { data: existingTags, error: tagsError } = await supabaseAdmin
    .from("segment_tags")
    .select("id, segment_id, tag_key, tag_type, created_by, created_at, tagged_profile_id")
    .eq("segment_id", segmentId);

  if (tagsError) {
    return errorResponse("DB_QUERY_FAILED", "Failed to load existing tags.", 500);
  }

  const { data: existingSuggestions, error: suggestionsError } = await supabaseAdmin
    .from("segment_tag_suggestions")
    .select("id, segment_id, tag_key, tag_type, status, source, suggested_by, decided_by, suggested_at, decided_at, narration_id, tagged_profile_id")
    .eq("segment_id", segmentId);

  if (suggestionsError) {
    return errorResponse("DB_QUERY_FAILED", "Failed to load existing tag suggestions.", 500);
  }

  const { data: narrations, error: narrationsError } = await supabaseAdmin
    .from("narrations")
    .select("id, media_asset_segment_id, transcript_raw, transcript_clean, created_at, author_id")
    .eq("media_asset_segment_id", segmentId)
    .order("created_at", { ascending: true })
    .limit(MAX_NARRATIONS);

  if (narrationsError) {
    return errorResponse("DB_QUERY_FAILED", "Failed to load narrations.", 500);
  }

  const { data: members, error: membersError } = await supabaseAdmin
    .from("org_members")
    .select("user_id, role, profiles (id, username, name)")
    .eq("org_id", orgId);

  if (membersError) {
    return errorResponse("DB_QUERY_FAILED", "Failed to load organization members.", 500);
  }

  const identityCandidates = (members ?? [])
    .map((member) => {
      const display = displayMemberName(member as OrgMemberRow);
      const username = member?.profiles?.username?.trim() ?? null;
      if (!display) return null;
      return {
        name: display,
        username,
      };
    })
    .filter((m): m is { name: string; username: string | null } => Boolean(m));

  const narrationPayload = (narrations ?? [])
    .map((row) => {
      const raw = asTrimmedString((row as NarrationRow).transcript_clean)
        ?? asTrimmedString((row as NarrationRow).transcript_raw);
      if (!raw) return null;
      return {
        id: (row as NarrationRow).id,
        author_id: (row as NarrationRow).author_id,
        created_at: (row as NarrationRow).created_at,
        text: clampText(raw, MAX_TEXT_CHARS),
      };
    })
    .filter((row): row is { id: string; author_id: string | null; created_at: string | null; text: string } => Boolean(row));

  if (narrationPayload.length === 0) {
    return jsonResponse({ applied_tags: [], skipped_tags: [] });
  }

  const payload = {
    segment: {
      id: segment.id,
      start_seconds: segment.start_seconds,
      end_seconds: segment.end_seconds,
    },
    media_asset: {
      id: segment.media_assets.id,
      file_name: segment.media_assets.file_name,
      duration_seconds: segment.media_assets.duration_seconds,
      created_at: segment.media_assets.created_at,
    },
    narrations: narrationPayload,
    existing_tags: (existingTags ?? []).map((tag) => ({
      tag_key: String(tag.tag_key ?? ""),
      tag_type: String(tag.tag_type ?? ""),
    })),
    available_tags: {
      action_tags: ACTION_TAGS,
      context_tags: ALL_CONTEXT_TAGS,
    },
    identity_candidates: identityCandidates,
  };

  let candidateTags: TagCandidateResponse = {};
  try {
    candidateTags = await callOpenAI(payload);
  } catch (err) {
    console.error("OpenAI tagging failed:", err);
    if (err instanceof Error && err.message.includes("OPENAI_API_KEY")) {
      return errorResponse("OPENAI_API_KEY_MISSING", "Missing OPENAI_API_KEY.", 500);
    }
    return errorResponse("UNEXPECTED_SERVER_ERROR", "Failed to generate tag suggestions.", 502);
  }

  const existingSet = new Set(
    (existingTags ?? [])
      .filter((tag) => String(tag.tag_type ?? "").toLowerCase() !== "identity")
      .map((tag) => `${String(tag.tag_type ?? "").toLowerCase()}|${String(tag.tag_key ?? "").toLowerCase()}`)
  );
  const existingIdentityKeys = new Set(
    (existingTags ?? []).flatMap((tag) => {
      if (String(tag.tag_type ?? "").toLowerCase() !== "identity") return [];
      const keys = [];
      const profileId = String(tag.tagged_profile_id ?? tag.created_by ?? "").trim();
      if (profileId) keys.push(profileId);
      const tagKey = String(tag.tag_key ?? "").toLowerCase();
      if (tagKey) keys.push(tagKey);
      return keys;
    })
  );
  const existingSuggestionSet = new Set(
    (existingSuggestions ?? [])
      .filter((tag) => String(tag.tag_type ?? "").toLowerCase() !== "identity")
      .map((tag) => `${String(tag.tag_type ?? "").toLowerCase()}|${String(tag.tag_key ?? "").toLowerCase()}`)
  );
  const existingIdentitySuggestionKeys = new Set(
    (existingSuggestions ?? []).flatMap((tag) => {
      if (String(tag.tag_type ?? "").toLowerCase() !== "identity") return [];
      const keys = [];
      const profileId = String(tag.tagged_profile_id ?? "").trim();
      if (profileId) keys.push(profileId);
      const tagKey = String(tag.tag_key ?? "").toLowerCase();
      if (tagKey) keys.push(tagKey);
      return keys;
    })
  );

  const actionLookup = buildLookup(ACTION_TAGS);
  const contextLookup = buildLookup(ALL_CONTEXT_TAGS);
  const identityLookup = new Map<string, { tag_key: string; tagged_profile_id: string }>();
  for (const member of members ?? []) {
    const display = displayMemberName(member as OrgMemberRow);
    const userId = String((member as OrgMemberRow)?.user_id ?? '').trim();
    if (!display) continue;
    if (!userId) continue;
    identityLookup.set(display.toLowerCase(), { tag_key: display, tagged_profile_id: userId });
    const username = member?.profiles?.username?.trim();
    if (username) {
      identityLookup.set(username.toLowerCase(), { tag_key: display, tagged_profile_id: userId });
    }
  }

  const skipped: Array<{ tag_key: string; tag_type: string; reason: string }> = [];
  const newTagKeys = new Set<string>();

  function collectTags(tagType: string, lookup: Map<string, string>, rawList: string[]) {
    const collected: Array<{ tag_key: string; tag_type: string; tagged_profile_id?: string | null }> = [];
    for (const raw of rawList.slice(0, MAX_TAGS_PER_TYPE)) {
      const normalized = normalizeCandidate(raw);
      const canonical = lookup.get(normalized);
      if (!canonical) continue;
      const key = `${tagType}|${canonical.toLowerCase()}`;
      if (existingSet.has(key)) {
        skipped.push({ tag_key: canonical, tag_type: tagType, reason: "existing" });
        continue;
      }
      if (existingSuggestionSet.has(key)) {
        skipped.push({ tag_key: canonical, tag_type: tagType, reason: "suggested" });
        continue;
      }
      if (newTagKeys.has(key)) continue;
      newTagKeys.add(key);
      collected.push({ tag_key: canonical, tag_type: tagType });
    }
    return collected;
  }

  function collectIdentityTags(rawList: string[]) {
    const collected: Array<{ tag_key: string; tag_type: string; tagged_profile_id: string }> = [];
    for (const raw of rawList.slice(0, MAX_TAGS_PER_TYPE)) {
      const normalized = normalizeCandidate(raw);
      const entry = identityLookup.get(normalized);
      if (!entry) continue;
      const key = `identity|${entry.tag_key.toLowerCase()}`;
      if (existingIdentityKeys.has(entry.tagged_profile_id) || existingIdentityKeys.has(entry.tag_key.toLowerCase())) {
        skipped.push({ tag_key: entry.tag_key, tag_type: "identity", reason: "existing" });
        continue;
      }
      if (existingIdentitySuggestionKeys.has(entry.tagged_profile_id) || existingIdentitySuggestionKeys.has(entry.tag_key.toLowerCase())) {
        skipped.push({ tag_key: entry.tag_key, tag_type: "identity", reason: "suggested" });
        continue;
      }
      if (newTagKeys.has(key)) continue;
      newTagKeys.add(key);
      collected.push({ tag_key: entry.tag_key, tag_type: "identity", tagged_profile_id: entry.tagged_profile_id });
    }
    return collected;
  }

  const actionTags = collectTags("action", actionLookup, normalizeTagList(candidateTags.action_tags));
  const contextTags = collectTags("context", contextLookup, normalizeTagList(candidateTags.context_tags));
  const identityTags = collectIdentityTags(normalizeTagList(candidateTags.identity_tags));

  const tagsToInsert = [...actionTags, ...contextTags, ...identityTags];
  if (tagsToInsert.length === 0) {
    return jsonResponse({ suggested_tags: [], skipped_tags: skipped });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("segment_tag_suggestions")
    .upsert(
      tagsToInsert.map((tag) => ({
        segment_id: segmentId,
        tag_key: tag.tag_key,
        tag_type: tag.tag_type,
        status: "pending",
        source: "ai",
        narration_id: narrationId ?? null,
        suggested_by: auth.userId,
        tagged_profile_id: tag.tagged_profile_id ?? null,
      })),
      {
        onConflict: "segment_id,tag_key,tag_type",
        ignoreDuplicates: true,
      }
    )
    .select("id, segment_id, tag_key, tag_type, status, source, suggested_by, decided_by, suggested_at, decided_at, narration_id, tagged_profile_id");

  if (insertError) {
    console.error("segment_tag_suggestions insert failed", {
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
      code: insertError.code,
    });
    if (insertError.code === "23503") {
      return jsonResponse({ suggested_tags: [], skipped_tags: skipped });
    }
    return errorResponse("DB_QUERY_FAILED", "Failed to insert tag suggestions.", 500);
  }

  return jsonResponse({
    suggested_tags: (inserted ?? []) as SegmentTagSuggestionRow[],
    skipped_tags: skipped,
  });
}));

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getAuthContext, getClientBoundToRequest, getServiceRoleClient } from "../_shared/auth.ts";
import { allowAdminBypass, getUserRoleFromRequest, requireAuthenticated, requireOrgRoleSource, requireRole } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

type ReviewBody = {
  segment_id?: string;
  suggestion_ids?: string[];
  action?: "apply" | "reject";
  apply_all?: boolean;
};

type SegmentTagRow = {
  id: string;
  segment_id: string;
  tag_key: string;
  tag_type: string;
  created_by: string | null;
  created_at: string | null;
  tagged_profile_id: string | null;
  status: string | null;
  source: string | null;
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
  profiles: {
    id: string;
    username: string | null;
    name: string | null;
  } | null;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

Deno.serve(withObservability("review-segment-tag-suggestions", async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
  }

  const body = (await req.json().catch(() => null)) as ReviewBody | null;
  const segmentId = asTrimmedString(body?.segment_id);
  const action = body?.action;
  const applyAll = body?.apply_all === true;
  const suggestionIds = asIdList(body?.suggestion_ids);

  if (!segmentId || (action !== "apply" && action !== "reject")) {
    return errorResponse("INVALID_REQUEST_BODY", "segment_id and action are required.", 400);
  }

  if (action === "reject" && suggestionIds.length === 0) {
    return errorResponse("INVALID_REQUEST_BODY", "suggestion_ids are required for reject.", 400);
  }

  if (action === "apply" && !applyAll && suggestionIds.length === 0) {
    return errorResponse("INVALID_REQUEST_BODY", "suggestion_ids or apply_all required for apply.", 400);
  }

  const auth = await getAuthContext(req);
  requireAuthenticated(auth.userId);

  const supabaseAdmin = getServiceRoleClient();
  const supabase = getClientBoundToRequest(req);

  const { data: segment, error: segmentError } = await supabaseAdmin
    .from("media_asset_segments")
    .select("id, media_assets (id, org_id)")
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

  let suggestionsQuery = supabaseAdmin
    .from("segment_tag_suggestions")
    .select("id, segment_id, tag_key, tag_type, status, source, suggested_by, decided_by, suggested_at, decided_at, narration_id, tagged_profile_id")
    .eq("segment_id", segmentId)
    .eq("status", "pending");

  if (!applyAll && suggestionIds.length > 0) {
    suggestionsQuery = suggestionsQuery.in("id", suggestionIds);
  }

  const { data: suggestions, error: suggestionsError } = await suggestionsQuery;

  if (suggestionsError) {
    return errorResponse("DB_QUERY_FAILED", "Failed to load tag suggestions.", 500);
  }

  const pendingSuggestions = (suggestions ?? []) as SegmentTagSuggestionRow[];
  if (pendingSuggestions.length === 0) {
    return jsonResponse({ applied_tags: [], updated_suggestions: [] });
  }

  const suggestionIdsToUpdate = pendingSuggestions.map((s) => s.id);

  if (action === "reject") {
    const { error: deleteError } = await supabaseAdmin
      .from("segment_tag_suggestions")
      .delete()
      .in("id", suggestionIdsToUpdate);

    if (deleteError) {
      return errorResponse("DB_QUERY_FAILED", "Failed to delete tag suggestions.", 500);
    }

    return jsonResponse({
      applied_tags: [],
      updated_suggestions: [],
    });
  }

  const { data: existingTags, error: tagsError } = await supabaseAdmin
    .from("segment_tags")
    .select("id, segment_id, tag_key, tag_type, created_by, created_at, tagged_profile_id, status, source")
    .eq("segment_id", segmentId);

  if (tagsError) {
    return errorResponse("DB_QUERY_FAILED", "Failed to load existing tags.", 500);
  }

  const { data: members, error: membersError } = await supabaseAdmin
    .from("org_members")
    .select("user_id, profiles (id, username, name)")
    .eq("org_id", orgId);

  if (membersError) {
    return errorResponse("DB_QUERY_FAILED", "Failed to load organization members.", 500);
  }

  const identityLookup = new Map<string, string>();
  for (const member of members ?? []) {
    const userId = String((member as OrgMemberRow)?.user_id ?? "").trim();
    if (!userId) continue;
    const name = (member as OrgMemberRow)?.profiles?.name?.trim();
    const username = (member as OrgMemberRow)?.profiles?.username?.trim();
    if (name) {
      identityLookup.set(name.toLowerCase(), userId);
    }
    if (username) {
      identityLookup.set(username.toLowerCase(), userId);
    }
  }

  const existingSet = new Set(
    (existingTags ?? [])
      .filter((tag) => String(tag.tag_type ?? "").toLowerCase() !== "identity")
      .map((tag) => `${String(tag.tag_type ?? "").toLowerCase()}|${String(tag.tag_key ?? "").toLowerCase()}`)
  );
  const existingIdentityProfiles = new Set(
    (existingTags ?? [])
      .filter((tag) => String(tag.tag_type ?? "").toLowerCase() === "identity")
      .map((tag) => String(tag.tagged_profile_id ?? tag.created_by ?? ""))
      .filter(Boolean)
  );

  const tagsToInsert = pendingSuggestions
    .map((suggestion) => {
      const tagType = String(suggestion.tag_type ?? "").toLowerCase();
      const tagKey = String(suggestion.tag_key ?? "");
      const fallbackProfileId = identityLookup.get(tagKey.toLowerCase()) ?? null;
      const targetProfileId = suggestion.tagged_profile_id ?? fallbackProfileId;
      return { suggestion, tagType, tagKey, targetProfileId };
    })
    .filter(({ suggestion, tagType, tagKey, targetProfileId }) => {
      const key = `${String(suggestion.tag_type ?? "").toLowerCase()}|${String(suggestion.tag_key ?? "").toLowerCase()}`;
      if (existingSet.has(key)) return false;
      if (tagType === "identity") {
        const targetId = String(targetProfileId ?? "");
        if (!targetId) return false;
        if (existingIdentityProfiles.has(targetId)) return false;
      }
      return true;
    })
    .map(({ suggestion, tagType, targetProfileId }) => ({
      segment_id: segmentId,
      tag_key: suggestion.tag_key,
      tag_type: suggestion.tag_type,
      created_by: auth.userId,
      tagged_profile_id: tagType === "identity" ? targetProfileId : null,
      status: "accepted",
      source: suggestion.source ?? "ai",
    }));

  let appliedTags: SegmentTagRow[] = [];
  if (tagsToInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("segment_tags")
      .insert(tagsToInsert)
      .select("id, segment_id, tag_key, tag_type, created_by, created_at, tagged_profile_id, status, source");

    if (insertError) {
      console.error("segment_tags insert failed", {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      });
      if (insertError.code === "23503" || insertError.code === "23505") {
        return jsonResponse({ applied_tags: [], updated_suggestions: [] });
      }
      return errorResponse("DB_QUERY_FAILED", "Failed to insert segment tags.", 500);
    }

    appliedTags = (inserted ?? []) as SegmentTagRow[];
  }

  const { error: deleteError } = await supabaseAdmin
    .from("segment_tag_suggestions")
    .delete()
    .in("id", suggestionIdsToUpdate);

  if (deleteError) {
    return errorResponse("DB_QUERY_FAILED", "Failed to delete tag suggestions.", 500);
  }

  return jsonResponse({
    applied_tags: appliedTags,
    updated_suggestions: [],
  });
}));

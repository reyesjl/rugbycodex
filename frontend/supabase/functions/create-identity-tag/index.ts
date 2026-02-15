import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getAuthContext, getClientBoundToRequest, getServiceRoleClient } from "../_shared/auth.ts";
import { allowAdminBypass, getUserRoleFromRequest, requireAuthenticated, requireOrgRoleSource, requireRole } from "../_shared/roles.ts";
import { withObservability } from "../_shared/observability.ts";

type Body = {
  segment_id?: string;
  tag_key?: string;
  tagged_profile_id?: string;
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

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

Deno.serve(withObservability("create-identity-tag", async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const segmentId = asTrimmedString(body?.segment_id);
  const tagKey = asTrimmedString(body?.tag_key);
  const taggedProfileId = asTrimmedString(body?.tagged_profile_id);

  if (!segmentId || !tagKey || !taggedProfileId) {
    return errorResponse("INVALID_REQUEST_BODY", "segment_id, tag_key, tagged_profile_id are required.", 400);
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

  const { data: existingTag, error: existingError } = await supabaseAdmin
    .from("segment_tags")
    .select("id, segment_id, tag_key, tag_type, created_by, created_at, tagged_profile_id, status, source")
    .eq("segment_id", segmentId)
    .eq("tag_type", "identity")
    .eq("tagged_profile_id", taggedProfileId)
    .maybeSingle();

  if (existingError) {
    return errorResponse("DB_QUERY_FAILED", "Failed to load existing identity tag.", 500);
  }

  if (existingTag) {
    return jsonResponse(existingTag as SegmentTagRow);
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("segment_tags")
    .insert({
      segment_id: segmentId,
      tag_key: tagKey,
      tag_type: "identity",
      created_by: auth.userId,
      tagged_profile_id: taggedProfileId,
      source: "manual",
    })
    .select("id, segment_id, tag_key, tag_type, created_by, created_at, tagged_profile_id, status, source")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: retryTag } = await supabaseAdmin
        .from("segment_tags")
        .select("id, segment_id, tag_key, tag_type, created_by, created_at, tagged_profile_id, status, source")
        .eq("segment_id", segmentId)
        .eq("tag_type", "identity")
        .eq("tagged_profile_id", taggedProfileId)
        .maybeSingle();
      if (retryTag) {
        return jsonResponse(retryTag as SegmentTagRow);
      }
    }
    return errorResponse("DB_QUERY_FAILED", "Failed to insert identity tag.", 500);
  }

  return jsonResponse(inserted as SegmentTagRow);
}));

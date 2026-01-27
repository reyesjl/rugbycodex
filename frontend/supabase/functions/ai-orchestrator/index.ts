import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/errors.ts";
import { getAuthContext, getClientBoundToRequest } from "../_shared/auth.ts";

import type {
  AssignmentContext,
  AutoAssignResponse,
  MatchSummaryResponse,
  MyRugbyCoachResponse,
  MyRugbyPlayerResponse,
  NarrationContext,
  OrchestratorMode,
  OrchestratorRequest,
  ProfileSummary,
  Role,
} from "./types.ts";

import { callLLM } from "./adapters/openai.ts";
import { getRequestId, logEvent } from "../_shared/observability.ts";
import {
  getUserRoleFromRequest,
  normalizeRole,
  requireAuthenticated,
  requireOrgRoleSource,
  requireRole,
  roleAtLeast,
} from "../_shared/roles.ts";
import { validateAutoAssignments } from "./policies/toolGuards.ts";
import { autoAssignPrompt } from "./prompts/autoAssign.ts";
import { matchSummaryPrompt } from "./prompts/matchSummary.ts";
import { myRugbyCoachPrompt } from "./prompts/myRugbyCoach.ts";
import { myRugbyPlayerPrompt } from "./prompts/myRugbyPlayer.ts";
import { attachSegmentToAssignment } from "./tools/attachSegmentToAssignment.ts";
import { attachTargetToAssignment } from "./tools/attachTargetToAssignment.ts";
import { createAssignment } from "./tools/createAssignment.ts";
import { listAssignmentsForOrg } from "./tools/listAssignmentsForOrg.ts";
import { listAssignmentsForProfile } from "./tools/listAssignmentsForProfile.ts";
import { listGroupMemberships } from "./tools/listGroupMemberships.ts";
import { listGroups } from "./tools/listGroups.ts";
import { listMatchAssets } from "./tools/listMatchAssets.ts";
import { listNarrationsForSegments } from "./tools/listNarrationsForSegments.ts";
import { listSegmentTags } from "./tools/listSegmentTags.ts";
import { listSegmentsForAssets } from "./tools/listSegmentsForAssets.ts";

function asNonEmptyString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function buildNarrationContext(
  narrations: Array<{
    media_asset_segment_id: string | null;
    transcript_raw: string | null;
    transcript_clean: string | null;
  }>,
  segmentMap: Map<string, { start_seconds: number | null; end_seconds: number | null }>,
  tagMap: Map<string, string[]>
): NarrationContext[] {
  const result: NarrationContext[] = [];
  for (const narration of narrations) {
    const segmentId = narration.media_asset_segment_id;
    if (!segmentId) continue;
    const text = String(narration.transcript_clean ?? narration.transcript_raw ?? "").trim();
    if (!text) continue;
    const segment = segmentMap.get(segmentId);
    result.push({
      text,
      segment_id: segmentId,
      start_seconds: segment?.start_seconds ?? null,
      end_seconds: segment?.end_seconds ?? null,
      tags: tagMap.get(segmentId) ?? [],
    });
  }
  return result;
}

function buildAssignmentContext(input: {
  assignments: Array<{ id: string; title: string | null; description: string | null }>;
  segments: Array<{ assignment_id: string; media_segment_id: string | null }>;
  targets: Array<{ assignment_id: string; target_type: string | null; target_id: string | null }>;
}): AssignmentContext[] {
  const assignmentById = new Map(input.assignments.map((a) => [a.id, a]));
  const segmentByAssignment = new Map<string, string | null>();
  for (const segment of input.segments) {
    if (!segmentByAssignment.has(segment.assignment_id)) {
      segmentByAssignment.set(segment.assignment_id, segment.media_segment_id ?? null);
    }
  }

  const result: AssignmentContext[] = [];
  for (const target of input.targets) {
    const assignment = assignmentById.get(target.assignment_id);
    if (!assignment) continue;
    result.push({
      title: assignment.title ?? "",
      description: assignment.description ?? null,
      segment_id: segmentByAssignment.get(target.assignment_id) ?? null,
      target_type: target.target_type ?? null,
    });
  }
  return result;
}

function ensureArrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST is allowed for this endpoint.", 405);
  }

  const requestId = getRequestId(req);

  try {
    console.warn("AUTH CLIENT DEBUG", {
      hasAuthorizationHeader: !!req.headers.get("Authorization"),
    });
    const { userId } = await getAuthContext(req);
    try {
      requireAuthenticated(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unauthorized";
      return errorResponse("AUTH_REQUIRED", message, 401);
    }

    let body: OrchestratorRequest;
    try {
      body = (await req.json()) as OrchestratorRequest;
    } catch {
      return errorResponse("INVALID_REQUEST", "Invalid JSON body", 400);
    }

    const requestUserId = asNonEmptyString(body?.user_id);
    const orgId = asNonEmptyString(body?.org_id);
    const mode = asNonEmptyString(body?.mode) as OrchestratorMode | null;

    if (!requestUserId || !orgId || !mode) {
      return errorResponse("MISSING_REQUIRED_FIELDS", "user_id, org_id, and mode are required", 400);
    }

    if (requestUserId !== userId) {
      return errorResponse("FORBIDDEN", "Forbidden", 403);
    }

    const supabase = getClientBoundToRequest(req);

    logEvent({
      severity: "info",
      event_type: "ai_orchestrator_request_start",
      request_id: requestId,
      function: "ai-orchestrator",
      user_id: requestUserId,
      org_id: orgId,
      mode,
    });

    const { userId: orgUserId, role, source } = await getUserRoleFromRequest(req, {
      supabase,
      orgId,
    });

    try {
      requireAuthenticated(orgUserId);
      requireOrgRoleSource(source);
    } catch (err) {
      const status = (err as any)?.status ?? 403;
      const message = err instanceof Error ? err.message : (status === 401 ? "Unauthorized" : "Forbidden");
      return errorResponse(status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN", message, status);
    }

    const normalizedRole: Role = normalizeRole(role);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, username")
      .eq("id", requestUserId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return errorResponse("NOT_FOUND", "Profile not found", 404);
    }

    const groupMemberships = await listGroupMemberships(supabase, profile.id);
    const groupIds = groupMemberships.map((row) => row.group_id);

    if (mode === "my_rugby") {
      requireRole(normalizedRole, "member");

      const roleMode = roleAtLeast(normalizedRole, "staff") ? "coach" : "player";
      const matchAssets = await listMatchAssets(supabase, orgId, 2);
      const assetIds = matchAssets.map((asset) => asset.id);
      const segments = await listSegmentsForAssets(supabase, assetIds);
      const segmentIds = segments.map((segment) => segment.id);
      const narrations = await listNarrationsForSegments(supabase, segmentIds);
      const tags = await listSegmentTags(supabase, segmentIds);
      const groups = await listGroups(supabase, orgId);

      const segmentMap = new Map(
        segments.map((segment) => [
          segment.id,
          { start_seconds: segment.start_seconds, end_seconds: segment.end_seconds },
        ])
      );

      const tagMap = new Map<string, string[]>();
      for (const tag of tags) {
        const existing = tagMap.get(tag.segment_id) ?? [];
        existing.push(tag.tag_key);
        tagMap.set(tag.segment_id, existing);
      }

      const narrationsContext = buildNarrationContext(narrations, segmentMap, tagMap);

      const assignmentsData = roleMode === "coach"
        ? await listAssignmentsForOrg(supabase, orgId)
        : await listAssignmentsForProfile(supabase, orgId, profile.id, groupIds);

      const assignmentContext = buildAssignmentContext(assignmentsData);

      const context = {
        user: {
          id: profile.id,
          name: profile.name ?? null,
          username: profile.username ?? null,
        } satisfies ProfileSummary,
        role_mode: roleMode,
        groups: groups.map((group) => ({ id: group.id, name: group.name ?? null })),
        narrations: narrationsContext,
        assignments: assignmentContext,
      };

      logEvent({
        severity: "info",
        event_type: "ai_orchestrator_my_rugby_context",
        request_id: requestId,
        function: "ai-orchestrator",
        user_id: requestUserId,
        org_id: orgId,
        role_mode: roleMode,
        asset_ids: assetIds,
        narration_count: narrationsContext.length,
        assignment_count: assignmentContext.length,
      });

      if (roleMode === "coach") {
        const { data: response } = await callLLM({
          messages: [
            { role: "system", content: myRugbyCoachPrompt },
            { role: "user", content: JSON.stringify(context) },
          ],
          response_format: "json",
        });

        const payload = response as MyRugbyCoachResponse;
        const focusAreas = ensureArrayOfStrings(payload?.focus_areas);
        if (!focusAreas.length) {
          throw new Error("Invalid coach response.");
        }

        return jsonResponse({ mode: "coach", focus_areas: focusAreas });
      }

      const { data: response } = await callLLM({
        messages: [
          { role: "system", content: myRugbyPlayerPrompt },
          { role: "user", content: JSON.stringify(context) },
        ],
        response_format: "json",
      });

      const payload = response as MyRugbyPlayerResponse;
      const workOns = ensureArrayOfStrings(payload?.work_ons);
      if (!workOns.length) {
        throw new Error("Invalid player response.");
      }

      return jsonResponse({ mode: "player", work_ons: workOns });
    }

    if (mode === "match_summary") {
      requireRole(normalizedRole, "staff");

      const assetId = asNonEmptyString(body?.context?.asset_id);
      if (!assetId) {
        return errorResponse("MISSING_REQUIRED_FIELDS", "context.asset_id is required", 400);
      }

      const { data: asset, error: assetError } = await supabase
        .from("media_assets")
        .select("id, org_id, file_name, duration_seconds, kind")
        .eq("id", assetId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (assetError) throw assetError;
      if (!asset || asset.kind !== "match") {
        return errorResponse("NOT_FOUND", "Match asset not found", 404);
      }

      const segments = await listSegmentsForAssets(supabase, [assetId]);
      const segmentIds = segments.map((segment) => segment.id);
      const narrations = await listNarrationsForSegments(supabase, segmentIds);

      const segmentMap = new Map(
        segments.map((segment) => [
          segment.id,
          { start_seconds: segment.start_seconds, end_seconds: segment.end_seconds },
        ])
      );

      const narrationsContext = buildNarrationContext(narrations, segmentMap, new Map());

      const context = {
        asset: {
          id: asset.id,
          file_name: asset.file_name ?? null,
          duration_seconds: asset.duration_seconds ?? null,
        },
        narrations: narrationsContext,
      };

      logEvent({
        severity: "info",
        event_type: "ai_orchestrator_match_summary_context",
        request_id: requestId,
        function: "ai-orchestrator",
        user_id: requestUserId,
        org_id: orgId,
        asset_ids: [assetId],
        narration_count: narrationsContext.length,
      });

      const { data: response } = await callLLM({
        messages: [
          { role: "system", content: matchSummaryPrompt },
          { role: "user", content: JSON.stringify(context) },
        ],
        response_format: "json",
      });

      const payload = response as MatchSummaryResponse;
      if (!payload || typeof payload.text !== "string" || !Array.isArray(payload.clips)) {
        throw new Error("Invalid match summary response.");
      }

      const segmentIdSet = new Set(segmentIds);
      const clips = payload.clips.filter((clip) => segmentIdSet.has(String(clip?.segment_id ?? "")));

      const jobPayload = {
        text: payload.text,
        clips,
      };

      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          org_id: orgId,
          media_asset_id: assetId,
          type: "match_summary",
          state: "completed",
          result: jobPayload,
        })
        .select("id")
        .single();

      if (jobError) throw jobError;

      logEvent({
        severity: "info",
        event_type: "ai_orchestrator_match_summary_saved",
        request_id: requestId,
        function: "ai-orchestrator",
        user_id: requestUserId,
        org_id: orgId,
        job_id: job?.id ?? null,
      });

      return jsonResponse({
        text: payload.text,
        clips,
        job_id: job?.id ?? null,
      });
    }

    if (mode === "auto_assign") {
      requireRole(normalizedRole, "staff");

      const assetId = asNonEmptyString(body?.context?.asset_id);
      const message = asNonEmptyString(body?.message);

      if (!assetId) {
        return errorResponse("MISSING_REQUIRED_FIELDS", "context.asset_id is required", 400);
      }

      if (!message) {
        return errorResponse("MISSING_REQUIRED_FIELDS", "message is required", 400);
      }

      const { data: asset, error: assetError } = await supabase
        .from("media_assets")
        .select("id, org_id, file_name, kind")
        .eq("id", assetId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (assetError) throw assetError;
      if (!asset || asset.kind !== "match") {
        return errorResponse("NOT_FOUND", "Match asset not found", 404);
      }

      const segments = await listSegmentsForAssets(supabase, [assetId]);
      const segmentIds = segments.map((segment) => segment.id);
      const narrations = await listNarrationsForSegments(supabase, segmentIds);
      const groups = await listGroups(supabase, orgId);
      const existingAssignments = await listAssignmentsForOrg(supabase, orgId);

      const segmentMap = new Map(
        segments.map((segment) => [
          segment.id,
          { start_seconds: segment.start_seconds, end_seconds: segment.end_seconds },
        ])
      );

      const narrationsContext = buildNarrationContext(narrations, segmentMap, new Map());

      const context = {
        asset: {
          id: asset.id,
          file_name: asset.file_name ?? null,
        },
        groups: groups.map((group) => ({ id: group.id, name: group.name ?? null })),
        narrations: narrationsContext,
        existing_assignments: buildAssignmentContext(existingAssignments),
      };

      logEvent({
        severity: "info",
        event_type: "ai_orchestrator_auto_assign_context",
        request_id: requestId,
        function: "ai-orchestrator",
        user_id: requestUserId,
        org_id: orgId,
        asset_ids: [assetId],
        narration_count: narrationsContext.length,
        assignment_count: context.existing_assignments.length,
      });

      const { data: response } = await callLLM({
        messages: [
          { role: "system", content: autoAssignPrompt },
          { role: "user", content: `${message}\n\nContext:\n${JSON.stringify(context)}` },
        ],
        response_format: "json",
      });

      const payload = response as AutoAssignResponse;
      const proposals = Array.isArray(payload?.assignments) ? payload.assignments : [];

      validateAutoAssignments(proposals, new Set(segmentIds), new Set(groups.map((g) => g.id)));

      const groupById = new Map(groups.map((group) => [group.id, group]));
      const results: Array<{
        assignment_id: string;
        title: string;
        segment_id: string;
        group_id: string;
        group_name: string | null;
        reason: string;
      }> = [];

      for (const proposal of proposals) {
        const assignmentId = await createAssignment(supabase, {
          org_id: orgId,
          created_by: requestUserId,
          title: proposal.title,
          description: proposal.description ?? null,
        });

        await attachSegmentToAssignment(supabase, assignmentId, proposal.segment_id);
        await attachTargetToAssignment(supabase, assignmentId, "group", proposal.group_id);

        results.push({
          assignment_id: assignmentId,
          title: proposal.title,
          segment_id: proposal.segment_id,
          group_id: proposal.group_id,
          group_name: groupById.get(proposal.group_id)?.name ?? null,
          reason: proposal.reason,
        });
      }

      logEvent({
        severity: "info",
        event_type: "ai_orchestrator_auto_assign_complete",
        request_id: requestId,
        function: "ai-orchestrator",
        user_id: requestUserId,
        org_id: orgId,
        assignment_count: results.length,
      });

      return jsonResponse({
        text: "Assignments created.",
        assignments: results,
      });
    }

    return errorResponse("INVALID_REQUEST", "Invalid mode", 400);
  } catch (err) {
    const status = (err as any)?.status;
    if (status === 401 || status === 403) {
      const message = err instanceof Error ? err.message : "Forbidden";
      return errorResponse(status === 401 ? "AUTH_REQUIRED" : "FORBIDDEN", message, status);
    }
    const error = err as { message?: string; stack?: string };
    logEvent({
      severity: "error",
      event_type: "ai_orchestrator_error",
      request_id: requestId,
      function: "ai-orchestrator",
      error_message: error?.message ?? String(err),
      stack: error?.stack,
    });
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return errorResponse("UNEXPECTED_SERVER_ERROR", message, 500);
  }
});

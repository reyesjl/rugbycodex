import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { getAuthContext } from "../_shared/auth.ts";

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
import { logError, logEvent } from "./observability.ts";
import { normalizeRole, requireRole, roleAtLeast } from "./policies/roleGuards.ts";
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

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { userId } = await getAuthContext(req);
    if (!userId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    let body: OrchestratorRequest;
    try {
      body = (await req.json()) as OrchestratorRequest;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const requestUserId = asNonEmptyString(body?.user_id);
    const orgId = asNonEmptyString(body?.org_id);
    const mode = asNonEmptyString(body?.mode) as OrchestratorMode | null;

    if (!requestUserId || !orgId || !mode) {
      return jsonResponse({ error: "user_id, org_id, and mode are required" }, 400);
    }

    if (requestUserId !== userId) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
      }
    );

    logEvent("ai_orchestrator_request_start", {
      user_id: requestUserId,
      org_id: orgId,
      mode,
    });

    const { data: membership, error: membershipError } = await supabase
      .from("org_members")
      .select("org_id, user_id, role")
      .eq("org_id", orgId)
      .eq("user_id", requestUserId)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!membership) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const role: Role = normalizeRole(membership.role);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, username")
      .eq("id", requestUserId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return jsonResponse({ error: "Profile not found" }, 404);
    }

    const groupMemberships = await listGroupMemberships(supabase, profile.id);
    const groupIds = groupMemberships.map((row) => row.group_id);

    if (mode === "my_rugby") {
      requireRole(role, "member");

      const roleMode = roleAtLeast(role, "staff") ? "coach" : "player";
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

      logEvent("ai_orchestrator_my_rugby_context", {
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
      requireRole(role, "staff");

      const assetId = asNonEmptyString(body?.context?.asset_id);
      if (!assetId) {
        return jsonResponse({ error: "context.asset_id is required" }, 400);
      }

      const { data: asset, error: assetError } = await supabase
        .from("media_assets")
        .select("id, org_id, file_name, duration_seconds, kind")
        .eq("id", assetId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (assetError) throw assetError;
      if (!asset || asset.kind !== "match") {
        return jsonResponse({ error: "Match asset not found" }, 404);
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

      logEvent("ai_orchestrator_match_summary_context", {
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

      logEvent("ai_orchestrator_match_summary_saved", {
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
      requireRole(role, "staff");

      const assetId = asNonEmptyString(body?.context?.asset_id);
      const message = asNonEmptyString(body?.message);

      if (!assetId) {
        return jsonResponse({ error: "context.asset_id is required" }, 400);
      }

      if (!message) {
        return jsonResponse({ error: "message is required" }, 400);
      }

      const { data: asset, error: assetError } = await supabase
        .from("media_assets")
        .select("id, org_id, file_name, kind")
        .eq("id", assetId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (assetError) throw assetError;
      if (!asset || asset.kind !== "match") {
        return jsonResponse({ error: "Match asset not found" }, 404);
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

      logEvent("ai_orchestrator_auto_assign_context", {
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

      logEvent("ai_orchestrator_auto_assign_complete", {
        user_id: requestUserId,
        org_id: orgId,
        assignment_count: results.length,
      });

      return jsonResponse({
        text: "Assignments created.",
        assignments: results,
      });
    }

    return jsonResponse({ error: "Invalid mode" }, 400);
  } catch (err) {
    logError("ai_orchestrator_error", err);
    return jsonResponse({ error: "Internal Server Error" }, 500);
  }
});

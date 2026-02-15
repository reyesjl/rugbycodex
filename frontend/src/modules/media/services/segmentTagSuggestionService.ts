import { supabase } from '@/lib/supabaseClient';
import type { PostgrestError } from '@supabase/supabase-js';
import { invokeEdge } from '@/lib/api';
import { handleEdgeFunctionError } from '@/lib/handleEdgeFunctionError';
import type { SegmentTag } from '@/modules/media/types/SegmentTag';
import type { SegmentTagSuggestion } from '@/modules/media/types/SegmentTagSuggestion';

type SegmentTagSuggestionRow = {
  id: string;
  segment_id: string;
  tag_key: string;
  tag_type: SegmentTagSuggestion['tag_type'];
  status: SegmentTagSuggestion['status'];
  source: string;
  suggested_by: string;
  decided_by: string | null;
  suggested_at: string | Date | null;
  decided_at: string | Date | null;
  narration_id: string | null;
  tagged_profile_id: string | null;
};

function asIsoString(value: string | Date | null, context: string): string {
  if (!value) {
    throw new Error(`Missing ${context} timestamp.`);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`Invalid ${context} timestamp.`);
    }
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${context} timestamp.`);
  }
  return value;
}

function toSegmentTagSuggestion(row: SegmentTagSuggestionRow): SegmentTagSuggestion {
  return {
    id: row.id,
    segment_id: row.segment_id,
    tag_key: row.tag_key,
    tag_type: row.tag_type,
    status: row.status,
    source: row.source,
    suggested_by: row.suggested_by,
    decided_by: row.decided_by ?? null,
    suggested_at: asIsoString(row.suggested_at, 'suggested_at'),
    decided_at: row.decided_at ? asIsoString(row.decided_at, 'decided_at') : null,
    narration_id: row.narration_id ?? null,
    tagged_profile_id: row.tagged_profile_id ?? null,
  };
}

async function listSuggestionsForSegmentsInternal(segmentIds: string[]): Promise<Record<string, SegmentTagSuggestion[]>> {
  const ids = Array.from(new Set(segmentIds.map((id) => String(id)).filter(Boolean)));
  if (ids.length === 0) return {};

  const { data, error } = (await supabase
    .from('segment_tag_suggestions')
    .select('id, segment_id, tag_key, tag_type, status, source, suggested_by, decided_by, suggested_at, decided_at, narration_id, tagged_profile_id')
    .in('segment_id', ids)
    .order('suggested_at', { ascending: true })) as {
    data: SegmentTagSuggestionRow[] | null;
    error: PostgrestError | null;
  };

  if (error) throw error;

  const grouped: Record<string, SegmentTagSuggestion[]> = {};
  for (const id of ids) {
    grouped[id] = [];
  }

  for (const row of data ?? []) {
    const segmentId = String(row.segment_id);
    const list = grouped[segmentId] ?? [];
    list.push(toSegmentTagSuggestion(row));
    grouped[segmentId] = list;
  }

  return grouped;
}

export const segmentTagSuggestionService = {
  async listSuggestionsForSegments(segmentIds: string[]): Promise<Record<string, SegmentTagSuggestion[]>> {
    return listSuggestionsForSegmentsInternal(segmentIds);
  },

  async listSuggestionsForSegment(segmentId: string): Promise<SegmentTagSuggestion[]> {
    if (!segmentId) return [];
    const grouped = await listSuggestionsForSegmentsInternal([segmentId]);
    return grouped[String(segmentId)] ?? [];
  },

  async applySuggestions(params: {
    segmentId: string;
    suggestionIds?: string[];
    applyAll?: boolean;
  }): Promise<{ applied_tags: SegmentTag[]; updated_suggestions: SegmentTagSuggestion[] }> {
    const segmentId = String(params.segmentId ?? '').trim();
    if (!segmentId) throw new Error('Missing segmentId.');

    const response = await invokeEdge('review-segment-tag-suggestions', {
      body: {
        segment_id: segmentId,
        suggestion_ids: params.suggestionIds ?? null,
        apply_all: Boolean(params.applyAll),
        action: 'apply',
      },
      orgScoped: true,
    });

    if (response.error) {
      throw await handleEdgeFunctionError(response.error, 'Unable to apply tag suggestions.');
    }

    const data = (response.data ?? {}) as {
      applied_tags?: SegmentTag[];
      updated_suggestions?: SegmentTagSuggestion[];
    };

    return {
      applied_tags: Array.isArray(data.applied_tags) ? data.applied_tags : [],
      updated_suggestions: Array.isArray(data.updated_suggestions) ? data.updated_suggestions : [],
    };
  },

  async rejectSuggestion(params: { segmentId: string; suggestionId: string }): Promise<SegmentTagSuggestion[]> {
    const segmentId = String(params.segmentId ?? '').trim();
    const suggestionId = String(params.suggestionId ?? '').trim();
    if (!segmentId) throw new Error('Missing segmentId.');
    if (!suggestionId) throw new Error('Missing suggestionId.');

    const response = await invokeEdge('review-segment-tag-suggestions', {
      body: {
        segment_id: segmentId,
        suggestion_ids: [suggestionId],
        action: 'reject',
      },
      orgScoped: true,
    });

    if (response.error) {
      throw await handleEdgeFunctionError(response.error, 'Unable to reject tag suggestion.');
    }

    const data = (response.data ?? {}) as {
      updated_suggestions?: SegmentTagSuggestion[];
    };

    return Array.isArray(data.updated_suggestions) ? data.updated_suggestions : [];
  },
};

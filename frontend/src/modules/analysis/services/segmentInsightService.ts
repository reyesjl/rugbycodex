import { supabase } from '@/lib/supabaseClient';
import type { PostgrestError } from '@supabase/supabase-js';
import type { SegmentInsight } from '@/modules/analysis/types/SegmentInsight';
import type { MatchSummaryState } from '@/modules/analysis/types/MatchSummary';

type SegmentInsightRow = {
  id: string;
  media_segment_id: string;
  state: string;
  insight_headline: string | null;
  insight_sentence: string | null;
  coach_script: string | null;
  narration_count_at_generation: number | null;
  coach_audio_url: string | null;
  coach_audio_generated_at: string | Date | null;
  model: string | null;
  prompt_version: string | null;
  generated_at: string | Date | null;
  is_active: boolean;
};

type SegmentInsightRecord = SegmentInsight & {
  media_segment_id: string;
  narration_count_at_generation?: number | null;
  coach_audio_url?: string | null;
  coach_audio_generated_at?: string | null;
  model?: string | null;
  prompt_version?: string | null;
  generated_at?: string | null;
};

function asIsoString(value: string | Date | null, context: string): string | null {
  if (!value) return null;
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

function toSegmentInsight(row: SegmentInsightRow): SegmentInsightRecord {
  const parseState = (value: unknown): MatchSummaryState => {
    const raw = String(value ?? '').toLowerCase();
    if (raw === 'empty' || raw === 'light' || raw === 'normal') {
      return raw as MatchSummaryState;
    }
    return 'normal';
  };
  return {
    state: parseState(row.state),
    insight_headline: row.insight_headline ?? null,
    insight_sentence: row.insight_sentence ?? null,
    coach_script: row.coach_script ?? null,
    media_segment_id: row.media_segment_id,
    narration_count_at_generation: row.narration_count_at_generation ?? null,
    coach_audio_url: row.coach_audio_url ?? null,
    coach_audio_generated_at: asIsoString(row.coach_audio_generated_at, 'coach_audio_generated_at'),
    model: row.model ?? null,
    prompt_version: row.prompt_version ?? null,
    generated_at: asIsoString(row.generated_at, 'generated_at'),
  };
}

export const segmentInsightService = {
  async listInsightsForSegments(segmentIds: string[]): Promise<Record<string, SegmentInsightRecord>> {
    const ids = Array.from(new Set(segmentIds.map((id) => String(id)).filter(Boolean)));
    if (ids.length === 0) return {};

    const { data, error } = (await supabase
      .from('segment_insights')
      .select(
        'id, media_segment_id, state, insight_headline, insight_sentence, coach_script, narration_count_at_generation, coach_audio_url, coach_audio_generated_at, model, prompt_version, generated_at, is_active'
      )
      .in('media_segment_id', ids)
      .eq('is_active', true)
      .order('generated_at', { ascending: false })) as {
      data: SegmentInsightRow[] | null;
      error: PostgrestError | null;
    };

    if (error) throw error;

    const bySegment: Record<string, SegmentInsightRecord> = {};
    for (const row of data ?? []) {
      const segmentId = String(row.media_segment_id);
      if (segmentId in bySegment) continue;
      bySegment[segmentId] = toSegmentInsight(row);
    }

    return bySegment;
  },
};

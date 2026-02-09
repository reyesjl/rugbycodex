import { invokeEdge } from "@/lib/api";
import { handleEdgeFunctionError } from "@/lib/handleEdgeFunctionError";
import type { MatchSummary, MatchSummaryState } from "@/modules/analysis/types/MatchSummary";
import type { SegmentInsight } from "@/modules/analysis/types/SegmentInsight";

export type MatchSummaryMode = 'state' | 'summary';

type CacheEntry<T> = {
  value: T;
  expiresAtMs: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const summaryCache = new Map<string, CacheEntry<MatchSummary>>();
const segmentSummaryCache = new Map<string, CacheEntry<SegmentInsight>>();

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function asMatchSummaryState(value: unknown): MatchSummaryState {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'empty' || v === 'light' || v === 'normal') return v;
  return 'empty';
}

function asSummaryText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function asInsightText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function asNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function cacheKey(mediaAssetId: string, mode: MatchSummaryMode): string {
  return `${String(mediaAssetId ?? '').trim()}:${mode}`;
}

function segmentCacheKey(mediaSegmentId: string, mode: MatchSummaryMode): string {
  return `segment:${String(mediaSegmentId ?? '').trim()}:${mode}`;
}

function getCachedSummary(mediaAssetId: string, mode: MatchSummaryMode): MatchSummary | null {
  const key = cacheKey(mediaAssetId, mode);
  if (!key) return null;

  const entry = summaryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAtMs) {
    summaryCache.delete(key);
    return null;
  }
  return entry.value;
}

function getCachedSegmentSummary(mediaSegmentId: string, mode: MatchSummaryMode): SegmentInsight | null {
  const key = segmentCacheKey(mediaSegmentId, mode);
  if (!key) return null;
  
  const entry = segmentSummaryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAtMs) {
    segmentSummaryCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedSummary(mediaAssetId: string, mode: MatchSummaryMode, value: MatchSummary) {
  const key = cacheKey(mediaAssetId, mode);
  if (!key) return;
  summaryCache.set(key, { value, expiresAtMs: Date.now() + CACHE_TTL_MS });
}

function setCachedSegmentSummary(mediaSegmentId: string, mode: MatchSummaryMode, value: SegmentInsight) {
  const key = segmentCacheKey(mediaSegmentId, mode);
  if (!key) return;
  segmentSummaryCache.set(key, { value, expiresAtMs: Date.now() + CACHE_TTL_MS });
}

export const analysisService = {
  /**
   * Fetches a match summary (uses a short-lived in-memory cache by default).
   */
  async getMatchSummary(
    mediaAssetId: string,
    options?: { forceRefresh?: boolean; mode?: MatchSummaryMode; skipCache?: boolean }
  ): Promise<MatchSummary> {
    const id = String(mediaAssetId ?? "").trim();
    if (!id) throw new Error("Missing mediaAssetId.");

    const mode: MatchSummaryMode = options?.mode ?? 'summary';

    if (!options?.forceRefresh && !options?.skipCache) {
      const cached = getCachedSummary(id, mode);
      if (cached) return cached;
    }

    const summary = await this.summarizeMediaAsset(id, {
      mode,
      forceRefresh: Boolean(options?.forceRefresh),
    });
    setCachedSummary(id, mode, summary);
    return summary;
  },

  async getSegmentSummary(
    mediaSegmentId: string,
    options?: { forceRefresh?: boolean; mode?: MatchSummaryMode; skipCache?: boolean }
  ): Promise<SegmentInsight> {
    const id = String(mediaSegmentId ?? "").trim();
    if (!id) throw new Error("Missing mediaSegmentId.");
    
    const mode: MatchSummaryMode = options?.mode ?? 'summary';
    
    if (!options?.forceRefresh && !options?.skipCache) {
      const cached = getCachedSegmentSummary(id, mode);
      if (cached) return cached;
    }
    
    const insight = await this.summarizeMediaSegment(id, {
      mode,
      forceRefresh: Boolean(options?.forceRefresh),
    });
    setCachedSegmentSummary(id, mode, insight);
    return insight;
  },

  async getSegmentCoachAudio(
    mediaSegmentId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<{ coach_audio_url: string; coach_audio_generated_at?: string | null }> {
    const id = String(mediaSegmentId ?? "").trim();
    if (!id) throw new Error("Missing mediaSegmentId.");

    const response = await invokeEdge("generate-coach-audio", {
      body: {
        media_segment_id: id,
        force_refresh: Boolean(options?.forceRefresh),
      },
      orgScoped: true,
    });

    if (response.error) {
      throw await handleEdgeFunctionError(response.error, "Unable to generate coach audio.");
    }

    const data = response.data as any;
    const coachAudioUrl = String(data?.coach_audio_url ?? "").trim();
    if (!coachAudioUrl) {
      throw new Error("Coach audio URL was not returned.");
    }

    return {
      coach_audio_url: coachAudioUrl,
      coach_audio_generated_at: data?.coach_audio_generated_at ?? null,
    };
  },

  /**
   * Calls the `summarize_media_asset` edge function to generate a short, neutral match summary.
   *
   * Authorization is enforced server-side via org role checks (owner/manager/staff).
   */
  async summarizeMediaAsset(
    mediaAssetId: string,
    options?: { mode?: MatchSummaryMode; forceRefresh?: boolean }
  ): Promise<MatchSummary> {
    const id = String(mediaAssetId ?? "").trim();
    if (!id) throw new Error("Missing mediaAssetId.");

    const mode: MatchSummaryMode = options?.mode ?? 'summary';

    const response = await invokeEdge("summarize-media-asset", {
      body: {
        media_asset_id: id,
        mode,
        force_refresh: Boolean(options?.forceRefresh),
      },
      orgScoped: true,
    });

    if (response.error) {
      throw await handleEdgeFunctionError(response.error, "Unable to generate match summary.");
    }

    const data = response.data as any;

    const state = asMatchSummaryState(data?.state);
    
    // Support both legacy bullets and new structured format
    const bullets = asStringArray(data?.bullets);
    const match_headline = asSummaryText(data?.match_headline);
    const match_summary = asStringArray(data?.match_summary);
    const sections = data?.sections && typeof data.sections === 'object' ? data.sections : undefined;

    const narration_count_at_generation = asNumber(data?.narration_count_at_generation);
    const narration_count_current = asNumber(data?.narration_count_current);
    const is_stale = asBoolean(data?.is_stale);

    const summary: MatchSummary = {
      state,
      // Legacy format
      bullets: state === 'normal' ? bullets : [],
      // New structured format (union type compatibility)
      ...(match_headline || match_summary.length > 0 || sections ? {
        match_headline: state === 'normal' ? match_headline : null,
        match_summary: state === 'normal' ? match_summary : [],
        sections: state === 'normal' ? sections : undefined,
      } : {})
    };
    summary.narration_count_at_generation = narration_count_at_generation;
    summary.narration_count_current = narration_count_current;
    summary.is_stale = is_stale;

    setCachedSummary(id, mode, summary);
    return summary;
  },

  async summarizeMediaSegment(
    mediaSegmentId: string,
    options?: { mode?: MatchSummaryMode; forceRefresh?: boolean }
  ): Promise<SegmentInsight> {
    const id = String(mediaSegmentId ?? "").trim();
    if (!id) throw new Error("Missing mediaSegmentId.");
    
    const mode: MatchSummaryMode = options?.mode ?? 'summary';
    
    const response = await invokeEdge("summarize-media-segment", {
      body: {
        media_segment_id: id,
        mode,
        force_refresh: Boolean(options?.forceRefresh),
      },
      orgScoped: true,
    });
    
    if (response.error) {
      throw await handleEdgeFunctionError(response.error, "Unable to generate segment summary.");
    }
    
    const data = response.data as any;
    
    const state = asMatchSummaryState(data?.state);
    
    const narration_count_at_generation = asNumber(data?.narration_count_at_generation);
    const narration_count_current = asNumber(data?.narration_count_current);
    const is_stale = asBoolean(data?.is_stale);

    const insight: SegmentInsight = {
      state,
      insight_headline: state === 'normal' ? asInsightText(data?.insight_headline) : null,
      insight_sentence: state === 'normal' ? asInsightText(data?.insight_sentence) : null,
      coach_script: state === 'normal' ? asInsightText(data?.coach_script) : null,
    };
    insight.narration_count_at_generation = narration_count_at_generation;
    insight.narration_count_current = narration_count_current;
    insight.is_stale = is_stale;
    
    setCachedSegmentSummary(id, mode, insight);
    return insight;
  },

  /** Clears in-memory caches (useful on logout/org switch). */
  clearCache() {
    summaryCache.clear();
    segmentSummaryCache.clear();
  },
};

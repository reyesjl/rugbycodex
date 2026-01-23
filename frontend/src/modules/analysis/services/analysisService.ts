import { invokeEdge } from "@/lib/api";
import { handleEdgeFunctionError } from "@/lib/handleEdgeFunctionError";
import type { MatchSummary, MatchSummaryState } from "@/modules/analysis/types/MatchSummary";

export type MatchSummaryMode = 'state' | 'summary';

type CacheEntry<T> = {
  value: T;
  expiresAtMs: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const summaryCache = new Map<string, CacheEntry<MatchSummary>>();

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function asMatchSummaryState(value: unknown): MatchSummaryState {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'empty' || v === 'light' || v === 'normal') return v;
  return 'empty';
}

function cacheKey(mediaAssetId: string, mode: MatchSummaryMode): string {
  return `${String(mediaAssetId ?? '').trim()}:${mode}`;
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

function setCachedSummary(mediaAssetId: string, mode: MatchSummaryMode, value: MatchSummary) {
  const key = cacheKey(mediaAssetId, mode);
  if (!key) return;
  summaryCache.set(key, { value, expiresAtMs: Date.now() + CACHE_TTL_MS });
}

export const analysisService = {
  /**
   * Fetches a match summary (uses a short-lived in-memory cache by default).
   */
  async getMatchSummary(
    mediaAssetId: string,
    options?: { forceRefresh?: boolean; mode?: MatchSummaryMode }
  ): Promise<MatchSummary> {
    const id = String(mediaAssetId ?? "").trim();
    if (!id) throw new Error("Missing mediaAssetId.");

    const mode: MatchSummaryMode = options?.mode ?? 'summary';

    if (!options?.forceRefresh) {
      const cached = getCachedSummary(id, mode);
      if (cached) return cached;
    }

    const summary = await this.summarizeMediaAsset(id, { mode });
    setCachedSummary(id, mode, summary);
    return summary;
  },

  /**
   * Calls the `summarize_media_asset` edge function to generate a short, neutral match summary.
   *
   * Authorization is enforced server-side via org role checks (owner/manager/staff).
   */
  async summarizeMediaAsset(mediaAssetId: string, options?: { mode?: MatchSummaryMode }): Promise<MatchSummary> {
    const id = String(mediaAssetId ?? "").trim();
    if (!id) throw new Error("Missing mediaAssetId.");

    const mode: MatchSummaryMode = options?.mode ?? 'summary';

    const response = await invokeEdge("summarize-media-asset", {
      body: {
        media_asset_id: id,
        mode,
      },
      orgScoped: true,
    });

    if (response.error) {
      throw await handleEdgeFunctionError(response.error, "Unable to generate match summary.");
    }

    const data = response.data as any;

    const state = asMatchSummaryState(data?.state);
    const bullets = asStringArray(data?.bullets);

    const summary: MatchSummary = {
      state,
      bullets: state === 'normal' ? bullets : [],
    };

    setCachedSummary(id, mode, summary);
    return summary;
  },

  /** Clears in-memory caches (useful on logout/org switch). */
  clearCache() {
    summaryCache.clear();
  },
};

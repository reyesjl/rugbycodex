import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseEdgeError } from "@/lib/handleSupabaseEdgeError";
import type { MatchSummary } from "@/modules/analysis/types/MatchSummary";

type CacheEntry<T> = {
  value: T;
  expiresAtMs: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const summaryCache = new Map<string, CacheEntry<MatchSummary>>();

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function getCachedSummary(mediaAssetId: string): MatchSummary | null {
  const key = String(mediaAssetId ?? "").trim();
  if (!key) return null;

  const entry = summaryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAtMs) {
    summaryCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedSummary(mediaAssetId: string, value: MatchSummary) {
  const key = String(mediaAssetId ?? "").trim();
  if (!key) return;
  summaryCache.set(key, { value, expiresAtMs: Date.now() + CACHE_TTL_MS });
}

export const analysisService = {
  /**
   * Fetches a match summary (uses a short-lived in-memory cache by default).
   */
  async getMatchSummary(
    mediaAssetId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<MatchSummary> {
    const id = String(mediaAssetId ?? "").trim();
    if (!id) throw new Error("Missing mediaAssetId.");

    if (!options?.forceRefresh) {
      const cached = getCachedSummary(id);
      if (cached) return cached;
    }

    const summary = await this.summarizeMediaAsset(id);
    setCachedSummary(id, summary);
    return summary;
  },

  /**
   * Calls the `summarize_media_asset` edge function to generate a short, neutral match summary.
   *
   * Authorization is enforced server-side via org role checks (owner/manager/staff).
   */
  async summarizeMediaAsset(mediaAssetId: string): Promise<MatchSummary> {
    const id = String(mediaAssetId ?? "").trim();
    if (!id) throw new Error("Missing mediaAssetId.");

    const response = await supabase.functions.invoke("summarize-media-asset", {
      body: {
        media_asset_id: id,
      },
    });

    if (response.error) {
      throw await handleSupabaseEdgeError(response.error, "Unable to generate match summary.");
    }

    const data = response.data as any;

    const summary: MatchSummary = {
      media_asset_id: String(data?.media_asset_id ?? id),
      org_id: String(data?.org_id ?? ""),
      bullets: asStringArray(data?.bullets),
      narration_count: Number(data?.narration_count ?? 0),
      model: data?.model ? String(data.model) : null,
      generated_at: String(data?.generated_at ?? new Date().toISOString()),
      truncation: data?.truncation
        ? {
            narrations_included: Number(data?.truncation?.narrations_included ?? 0),
            narrations_total: Number(data?.truncation?.narrations_total ?? 0),
            text_max_chars: Number(data?.truncation?.text_max_chars ?? 0),
          }
        : undefined,
    };

    setCachedSummary(id, summary);
    return summary;
  },

  /** Clears in-memory caches (useful on logout/org switch). */
  clearCache() {
    summaryCache.clear();
  },
};

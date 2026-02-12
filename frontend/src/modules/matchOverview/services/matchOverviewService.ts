import { supabase } from '@/lib/supabaseClient';
import type { MatchOverviewDTO } from '@/modules/matchOverview/types/MatchOverview';

type CacheEntry<T> = {
  value: T;
  expiresAtMs: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const overviewCache = new Map<string, CacheEntry<MatchOverviewDTO>>();

function cacheKey(mediaAssetId: string, trendWindow: number, feedLimit: number): string {
  return `${String(mediaAssetId ?? '').trim()}:${trendWindow}:${feedLimit}`;
}

function getCachedOverview(
  mediaAssetId: string,
  trendWindow: number,
  feedLimit: number
): MatchOverviewDTO | null {
  const key = cacheKey(mediaAssetId, trendWindow, feedLimit);
  if (!key) return null;
  const entry = overviewCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAtMs) {
    overviewCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedOverview(
  mediaAssetId: string,
  trendWindow: number,
  feedLimit: number,
  value: MatchOverviewDTO
) {
  const key = cacheKey(mediaAssetId, trendWindow, feedLimit);
  if (!key) return;
  overviewCache.set(key, { value, expiresAtMs: Date.now() + CACHE_TTL_MS });
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export const matchOverviewService = {
  async getOverview(
    orgId: string,
    mediaAssetId: string,
    options?: { trendWindow?: number; feedLimit?: number; forceRefresh?: boolean; skipCache?: boolean }
  ): Promise<MatchOverviewDTO> {
    const id = String(mediaAssetId ?? '').trim();
    const org = String(orgId ?? '').trim();
    if (!id) throw new Error('Missing mediaAssetId.');
    if (!org) throw new Error('Missing orgId.');

    const trendWindow = options?.trendWindow ?? 3;
    const feedLimit = options?.feedLimit ?? 20;

    if (!options?.forceRefresh && !options?.skipCache) {
      const cached = getCachedOverview(id, trendWindow, feedLimit);
      if (cached) return cached;
    }

    const { data, error } = await supabase.rpc('rpc_get_match_overview_v1', {
      p_org_id: org,
      p_media_asset_id: id,
      p_trend_window: trendWindow,
      p_feed_limit: feedLimit,
    });

    if (error) throw error;
    if (!data) {
      throw new Error('No match overview data returned.');
    }

    const payload = data as MatchOverviewDTO;

    const normalized: MatchOverviewDTO = {
      ...payload,
      story: {
        summary: payload.story?.summary ?? null,
        momentum_timeline: asArray(payload.story?.momentum_timeline),
        themes: asArray(payload.story?.themes),
      },
      tactical_patterns: {
        set_pieces: asArray(payload.tactical_patterns?.set_pieces),
        actions: asArray(payload.tactical_patterns?.actions),
        transitions: asArray(payload.tactical_patterns?.transitions),
      },
      player_impact: asArray(payload.player_impact),
      trends: asArray(payload.trends),
      intelligence_feed: asArray(payload.intelligence_feed),
    };

    setCachedOverview(id, trendWindow, feedLimit, normalized);
    return normalized;
  },

  clearCache() {
    overviewCache.clear();
  },
};

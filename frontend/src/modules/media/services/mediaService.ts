import { supabase } from "@/lib/supabaseClient";
import type { OrgMediaAsset } from "@/modules/media/types/OrgMediaAsset";
import type { PostgrestError } from "@supabase/supabase-js";

const HLS_PLAYLIST_MIME = "application/vnd.apple.mpegurl";
const RETRY_DELAYS_MS = [500, 1000, 1500];
const MAX_RETRY_ATTEMPTS = 3;
const PLAYBACK_ERROR_MESSAGE = "Unable to play this clip right now.";

/**
 * Represents a row in the media assets table, containing metadata about a media file
 * associated with an organization.
 */
type MediaAssetRow = {
  id: string;
  org_id: string;
  uploader_id: string;
  bucket: string;
  storage_path: string;
  file_size_bytes: number;
  mime_type: string;
  duration_seconds: number;
  checksum: string;
  source: string;
  file_name: string;
  title?: string | null;
  kind: string;
  status: string;
  hls_url?: string | null;
  created_at: string | Date | null;
  base_org_storage_path: string;
};

type RowOptions = MediaAssetRow;

/**
 * Represents the result of a list query operation, returning a promise-like object.
 *
 * @template T - The type of items in the returned data array.
 * @property {T[] | null} data - The array of items returned by the query, or null if no data is available.
 * @property {PostgrestError | null} error - The error object if the query failed, or null if successful.
 */
type ListQueryResult<T = unknown> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
/**
 * Represents the result of a single query operation.
 * 
 * @template T - The type of the data returned by the query.
 * @property {T | null} data - The data returned from the query, or null if no data is available.
 * @property {PostgrestError | null} error - The error encountered during the query, or null if the query was successful.
 * @returns {PromiseLike<{ data: T | null; error: PostgrestError | null }>} A promise-like object containing the query result.
 */
type SingleQueryResult<T = unknown> = PromiseLike<{ data: T | null; error: PostgrestError | null }>;

type NarrationCountRow = {
  media_asset_id: string | null;
  count: number | string | null;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFunctionErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const maybe = error as {
    status?: number;
    context?: { status?: number; response?: { status?: number } };
  };
  return maybe.status ?? maybe.context?.status ?? maybe.context?.response?.status ?? null;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  return name === "FunctionsFetchError";
}

function isRetryableFunctionError(error: unknown): boolean {
  const status = getFunctionErrorStatus(error);
  if (status === 503) return true;
  if (status === 404) return false;
  if (status !== null) return false;
  return isNetworkError(error);
}

function isNotFoundFunctionError(error: unknown): boolean {
  return getFunctionErrorStatus(error) === 404;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  isRetryable: (error: unknown) => boolean
): Promise<T> {
  let retries = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryable(error)) {
        throw error;
      }

      if (retries >= MAX_RETRY_ATTEMPTS) {
        const finalError = new Error(PLAYBACK_ERROR_MESSAGE);
        (finalError as Error & { cause?: unknown }).cause = error;
        throw finalError;
      }

      const delayMs = RETRY_DELAYS_MS[retries] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] ?? 0;
      retries += 1;
      if (delayMs > 0) {
        await delay(delayMs);
      }
    }
  }
}

async function fetchSignedHlsPlaylist(mediaId: string): Promise<string> {
  const response = await supabase.functions.invoke("get-wasabi-playback-playlist", {
    body: {
      media_id: mediaId,
    },
  });

  if (response.error) {
    throw response.error;
  }

  return typeof response.data === "string" ? response.data : String(response.data ?? "");
}

function asDate(value: string | Date | null, context: string): Date {
  if (!value) {
    throw new Error(`Missing ${context} timestamp.`);
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${context} timestamp.`);
  }
  return parsed;
}

/**
 * Retrieves a list of items from the provided query result.
 *
 * @template T - The type of items in the list.
 * @param query - A promise that resolves to a `ListQueryResult<T>`, containing the data and error information.
 * @returns A promise that resolves to an array of items of type `T`. Returns an empty array if no data is present.
 * @throws Throws an error if the query result contains an error.
 */
async function getList<T = RowOptions>(query: ListQueryResult<T>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/**
 * Retrieves a single result from a query, throwing an error if not found or if the query fails.
 *
 * @template T - The type of the expected result.
 * @param query - A promise resolving to a single query result containing data and error properties.
 * @param notFoundMessage - The error message to throw if no data is found.
 * @returns A promise that resolves to the retrieved data of type T.
 * @throws Will throw an error if the query fails or if no data is found.
 */
async function getSingle<T = RowOptions>(query: SingleQueryResult<T>, notFoundMessage: string): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  if (!data) {
    throw new Error(notFoundMessage);
  }
  return data;
}

function toOrgMediaAsset(row: MediaAssetRow): OrgMediaAsset {
  return {
    id: row.id,
    org_id: row.org_id,
    uploader_id: row.uploader_id,
    bucket: row.bucket,
    storage_path: row.storage_path,
    file_size_bytes: row.file_size_bytes,
    mime_type: row.mime_type,
    duration_seconds: row.duration_seconds,
    checksum: row.checksum,
    source: row.source,
    file_name: row.file_name,
    title: row.title ?? null,
    kind: row.kind,
    status: row.status,
    hls_url: row.hls_url ?? null,
    created_at: asDate(row.created_at, 'media asset creation'),
    base_org_storage_path: row.base_org_storage_path,
  };
}


export const mediaService = {

  /**
   * Returns narration counts grouped by media_asset_id for a given org.
   *
   * Shape: [{ media_asset_id, count }]
   */
  async getNarrationCountsByOrg(orgId: string): Promise<Array<{ media_asset_id: string; count: number }>> {
    const { data, error } = await supabase.rpc('get_narration_counts_by_org', {
      p_org_id: orgId,
    });

    if (error) throw error;

    const rows = (data ?? []) as Array<NarrationCountRow>;

    return rows
      .filter((row) => !!row.media_asset_id)
      .map((row) => ({
        media_asset_id: row.media_asset_id as string,
        count: typeof row.count === 'number' ? row.count : Number(row.count ?? 0),
      }));
  },

  async updateMediaAsset(id: string, fields: Partial<OrgMediaAsset>) {
    return supabase
      .from('media_assets')
      .update(fields)
      .eq('id', id);
  },

  /**
    * Returns media assets for an organization, optionally filtered.
    */
  async listByOrganization(
    orgId: string,
    options: { limit?: number; status?: string; bucket?: string } = {}
  ): Promise<OrgMediaAsset[]> {
    let query = supabase
      .from('media_assets')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.bucket) {
      query = query.eq('bucket', options.bucket);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const rows = await getList<MediaAssetRow>(query);
    return rows.map(toOrgMediaAsset);
  },

  /**
    * Returns the total duration (seconds) for an organization by summing `media_assets.duration_seconds`.
    */
  async getTotalDurationSeconds(orgId: string): Promise<number> {
    const rows = await getList<{ duration_seconds: number | null }>(
      supabase.from('media_assets').select('duration_seconds').eq('org_id', orgId)
    );
    return rows.reduce((total, row) => total + (row.duration_seconds ?? 0), 0);
  },

  /**
    * Returns the total media duration (seconds) across all organizations.
    */
  async getTotalDurationSecondsAll(): Promise<number> {
    const rows = await getList<{ duration_seconds: number | null }>(
      supabase.from('media_assets').select('duration_seconds')
    );
    return rows.reduce((total, row) => total + (row.duration_seconds ?? 0), 0);
  },

  /**
    * Retrieves a single media asset by id, scoped to an organization.
    */
  async getById(orgId: string, id: string): Promise<OrgMediaAsset> {
    const row = await getSingle<MediaAssetRow>(
      supabase.from('media_assets').select('*').eq('org_id', orgId).eq('id', id).single(),
      `Media asset not found with id: ${id}`
    );
    return toOrgMediaAsset(row);
  },

  /**
    * Deletes a media_assets row by id.
    */
  async deleteById(id: string): Promise<void> {
    const { error } = await supabase.from('media_assets').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Retrieves an HLS playlist (m3u8) for playback via Supabase Edge Function,
   * wraps it in a Blob, and returns an object URL.
   */
  async getSignedHlsPlaylistObjectUrl(mediaId: string): Promise<string> {
    let playlistText: string;
    try {
      playlistText = await withRetry(
        () => fetchSignedHlsPlaylist(mediaId),
        isRetryableFunctionError
      );
    } catch (error) {
      if (isNotFoundFunctionError(error)) {
        throw new Error("This clip is not ready for playback yet.");
      }
      if (error instanceof Error && error.message === PLAYBACK_ERROR_MESSAGE) {
        throw error;
      }
      const userError = new Error(PLAYBACK_ERROR_MESSAGE);
      (userError as Error & { cause?: unknown }).cause = error;
      throw userError;
    }

    if (!playlistText.trim()) {
      throw new Error("This clip is not ready for playback yet.");
    }

    const blob = new Blob([playlistText], { type: HLS_PLAYLIST_MIME });
    return URL.createObjectURL(blob);
  },

}

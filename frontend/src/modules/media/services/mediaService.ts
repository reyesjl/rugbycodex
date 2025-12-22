import { supabase } from "@/lib/supabaseClient";
import type { OrgMediaAsset } from "@/modules/media/types/OrgMediaAsset";
import type { PostgrestError } from "@supabase/supabase-js";

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
  status: string;
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
    status: row.status,
    created_at: asDate(row.created_at, 'media asset creation'),
    base_org_storage_path: row.base_org_storage_path,
  };
}


export const mediaService = {

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

}

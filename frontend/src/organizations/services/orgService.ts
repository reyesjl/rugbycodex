import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import type { CreateOrganizationInput, Organization, OrganizationUpdateFields, OrgMediaAsset } from '@/organizations/types';

/**
 * orgServiceV2 centralizes organization-centric behavior and replaces `org_service.ts`.
 * Namespaces:
 * - `organizations`: CRUD operations and field updates for `organizations`.
 * - `mediaAssets`: helpers for fetching org media rows from `media_assets`.
 *
 * Usage:
 * ```ts
 * import { orgService } from '@/services/orgService';
 *
 * const orgs = await orgService.organizations.list();
 * const org = await orgService.organizations.getBySlug('club-slug');
 * await orgService.organizations.updateBio(org.id, 'New mission statement');
 * await orgService.mediaAssets.listByOrganization(org.id, { limit: 20 });
 * ```
 */

type RowOptions = OrganizationRow | MediaAssetRow;

/**
 * Represents a row of organization data.
*/
type OrganizationRow = {
  id: string;
  owner: string | null;
  slug: string;
  name: string;
  created_at: string | Date | null;
  storage_limit_mb: number;
  bio: string | null;
};

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
};



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

function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    owner: row.owner,
    slug: row.slug,
    name: row.name,
    created_at: asDate(row.created_at, 'organization creation'),
    storage_limit_mb: row.storage_limit_mb,
    bio: row.bio,
  };
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
  };
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

const MAX_BIO_LENGTH = 500;

function validateBio(bio: string | null): string | null {
  if (!bio) {
    return null;
  }
  if (bio.length > MAX_BIO_LENGTH) {
    throw new Error(`Bio exceeds maximum length of ${MAX_BIO_LENGTH} characters.`);
  }
  return bio;
}

export const orgService = {
  organizations: {
    /**
     * Returns all organizations ordered by creation date.
     * @notes This returns all organizations that the current user can see.
     * @throws Error if the query fails.
     */
    async list(): Promise<Organization[]> {
      const rows = await getList<OrganizationRow>(
        supabase.from('organizations').select('*').order('created_at', { ascending: false })
      );
      return rows.map(toOrganization);
    },

    /**
     * Looks up an organization by ID.
     * @throws Error if the organization does not exist.
     */
    async getById(id: string): Promise<Organization> {
      const row = await getSingle<OrganizationRow>(
        supabase.from('organizations').select('*').eq('id', id).single(),
        `Organization not found with id: ${id}`
      );
      return toOrganization(row);
    },

    /**
     * Looks up an organization by slug.
     * @throws Error if no matching slug exists.
     */
    async getBySlug(slug: string): Promise<Organization> {
      const row = await getSingle<OrganizationRow>(
        supabase.from('organizations').select('*').eq('slug', slug).single(),
        `Organization not found by slug: ${slug}`
      );
      return toOrganization(row);
    },

    /**
     * Creates a new organization row and returns the normalized entity.
     * @throws Error if creation fails.
     */
    async create(input: CreateOrganizationInput): Promise<Organization> {
      const payload = {
        name: input.name,
        slug: input.slug,
        owner: input.owner ?? null,
        storage_limit_mb: input.storage_limit_mb ?? 10240,
        bio: validateBio(input.bio ?? null),
      };

      const row = await getSingle<OrganizationRow>(
        supabase.from('organizations').insert(payload).select('*').single(),
        'Organization creation failed.'
      );

      return toOrganization(row);
    },

    /**
     * Updates an organization by its ID with the provided fields.
     *
     * Validates the `bio` field if present in the updates.
     * Throws an error if the organization with the given ID is not found.
     *
     * @param id - The unique identifier of the organization to update.
     * @param updates - A partial object containing the fields to update.
     * @returns A promise that resolves to the updated `Organization` object.
     */
    async updateById(
      id: string,
      updates: Partial<Pick<Organization, OrganizationUpdateFields>>
    ): Promise<Organization> {
      const payload = { ...updates };
      if ('bio' in payload) {
        payload.bio = validateBio(payload.bio ?? null);
      }

      const row = await getSingle<OrganizationRow>(
        supabase.from('organizations').update(payload).eq('id', id).select('*').single(),
        `Organization not found with id: ${id}`
      );
      return toOrganization(row);
    },

    /**
     * Updates only the organization bio field after validating length.
     * @param bio New bio text or null to clear.
     * @returns Updated organization entity.
     */
    async updateBio(id: string, bio: string | null): Promise<Organization> {
      const normalizedBio = validateBio(bio);
      const row = await getSingle<OrganizationRow>(
        supabase.from('organizations').update({ bio: normalizedBio }).eq('id', id).select('*').single(),
        `Organization not found with id: ${id}`
      );
      return toOrganization(row);
    },

    /**
     * Deletes an organization by its unique identifier.
     *
     * @param id - The unique identifier of the organization to delete.
     * @returns A promise that resolves when the organization is deleted.
     * @throws Will throw an error if the deletion fails.
     */
    async deleteById(id: string): Promise<void> {
      const { error } = await supabase.from('organizations').delete().eq('id', id);
      if (error) {
        throw error;
      }
    },
  },

  mediaAssets: {
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
  },
};


import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

/**
 * orgServiceV2 centralizes organization-centric behavior and replaces `org_service.ts`.
 * Namespaces:
 * - `organizations`: CRUD operations and field updates for `organizations`.
 * - `mediaAssets`: helpers for fetching org media rows from `media_assets`.
 *
 * Usage:
 * ```ts
 * import { orgServiceV2 } from '@/services/orgServiceV2';
 *
 * const orgs = await orgServiceV2.organizations.list();
 * const org = await orgServiceV2.organizations.getBySlug('club-slug');
 * await orgServiceV2.organizations.updateBio(org.id, 'New mission statement');
 * await orgServiceV2.mediaAssets.listByOrganization(org.id, { limit: 20 });
 * ```
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

/** Single organization row returned to consumers. */
export type Organization = {
  id: string;
  owner: string | null;
  slug: string;
  name: string;
  created_at: Date;
  storage_limit_mb: number;
  bio: string | null;
};

/** DTO for creating organizations programmatically. */
export type CreateOrganizationInput = {
  name: string;
  slug: string;
  owner?: string | null;
  storage_limit_mb?: number;
  bio?: string | null;
};

/** Minimal media asset metadata tied to an organization. */
export type OrgMediaAsset = {
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
  created_at: Date;
};

type ListQueryResult<T = unknown> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
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

async function getList<T = unknown>(query: ListQueryResult<T>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function getSingle<T = unknown>(query: SingleQueryResult<T>, notFoundMessage: string): Promise<T> {
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

export const orgServiceV2 = {
  organizations: {
    /**
     * Returns all organizations ordered by creation date.
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
     * Partially updates organization fields (name, slug, owner, storage, bio).
     */
    async updateById(
      id: string,
      updates: Partial<Pick<Organization, 'name' | 'slug' | 'owner' | 'storage_limit_mb' | 'bio'>>
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
     */
    async updateBio(id: string, bio: string): Promise<Organization> {
      const normalizedBio = validateBio(bio);
      const row = await getSingle<OrganizationRow>(
        supabase.from('organizations').update({ bio: normalizedBio }).eq('id', id).select('*').single(),
        `Organization not found with id: ${id}`
      );
      return toOrganization(row);
    },

    /**
     * Deletes an organization row.
     */
    async deleteById(id: string): Promise<void> {
      const { error } = await supabase.from('organizations').delete().eq('id', id).select('id').single();
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

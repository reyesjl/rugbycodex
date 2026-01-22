import { supabase } from "@/lib/supabaseClient";
import { invokeEdge } from "@/lib/api";
import { requireUserId } from "@/modules/auth/identity";
import type { Narration, NarrationSourceType } from "../types/Narration";
import type { PostgrestError } from "@supabase/supabase-js";
import { handleSupabaseEdgeError } from "@/lib/handleSupabaseEdgeError";

/**
 * Service layer for narration data access and mutation.
 *
 * Responsibility:
 * - Encapsulates all narration-related I/O.
 * - Follows existing service patterns from mediaService and profileServiceV2.
 *
 * This service does NOT:
 * - Hold state
 * - Perform permission checks beyond API shape (RLS handles auth)
 * - Derive UI logic
 *
 * Authorization is enforced via Supabase RLS.
 */

type NarrationRow = {
  id: string;
  org_id: string;
  media_asset_id: string;
  media_asset_segment_id: string;
  author_id: string | null;
  source_type: string | null;
  audio_storage_path: string | null;
  transcript_raw: string;
  transcript_clean: string | null;
  transcript_lang: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type NarrationSearchResultRow = {
  narration_id?: string | null;
  narrationId?: string | null;
  media_asset_segment_id?: string | null;
  segment_id?: string | null;
  media_asset_id?: string | null;
  org_id?: string | null;
};

type SingleQueryResult<T = unknown> = PromiseLike<{ data: T | null; error: PostgrestError | null }>;
type ListQueryResult<T = unknown> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

function asDate(value: string | Date, context: string): Date {
  if (!value) {
    throw new Error(`Missing ${context} timestamp.`);
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${context} timestamp.`);
  }
  return parsed;
}

async function getSingle<T = NarrationRow>(
  query: SingleQueryResult<T>,
  notFoundMessage: string
): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  if (!data) throw new Error(notFoundMessage);
  return data;
}

async function getList<T = NarrationRow>(query: ListQueryResult<T>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

function normalizeNarrationSourceType(value: unknown): NarrationSourceType {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'coach' || raw === 'staff' || raw === 'member' || raw === 'ai') {
    return raw as NarrationSourceType;
  }
  return 'member';
}

function normalizeEmbeddingVector(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const nums = value.map((v) => Number(v));
  if (nums.some((n) => !Number.isFinite(n))) return [];
  return nums;
}

function mapMembershipRoleToNarrationSourceType(role: unknown): NarrationSourceType {
  const raw = String(role ?? '').toLowerCase();
  if (raw === 'owner') return 'coach';
  if (raw === 'manager' || raw === 'staff') return 'staff';
  if (raw === 'member') return 'member';
  return 'member';
}

async function getOrgMemberRole(orgId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.role as string | null) ?? null;
}

function toNarration(row: NarrationRow): Narration {
  return {
    id: row.id,
    org_id: row.org_id,
    media_asset_id: row.media_asset_id,
    media_asset_segment_id: row.media_asset_segment_id,
    author_id: row.author_id,
    // Ensure null/legacy values safely default to member.
    source_type: normalizeNarrationSourceType(row.source_type),
    audio_storage_path: row.audio_storage_path,
    transcript_raw: row.transcript_raw,
    transcript_clean: row.transcript_clean,
    transcript_lang: row.transcript_lang,
    created_at: asDate(row.created_at, "created_at"),
    updated_at: asDate(row.updated_at, "updated_at"),
  };
}

function triggerNarrationEmbedding(narrationId: string): void {
  // Fire-and-forget: do not await; do not block UI; swallow errors.
  void (async () => {
    try {
      const { error } = await invokeEdge('generate-narration-embedding', {
        body: { narrationId },
      });
      if (error) {
        // Consistent with codebase: await and warn, do not throw
        const normalized = await handleSupabaseEdgeError(error, '[embedding] Embedding trigger failed');
        console.warn('[embedding] Embedding trigger error (swallowed):', normalized);
      }
    } catch (err) {
      console.warn('[embedding] Failed to trigger embedding generation:', err);
    }
  })();
}

async function generateQueryEmbedding(queryText: string): Promise<number[]> {
  const trimmed = String(queryText ?? '').trim();
  if (!trimmed) {
    throw new Error('Missing query text.');
  }

  const { data, error } = await invokeEdge('generate-query-embedding', {
    body: { query_text: trimmed },
  });

  if (error) {
    throw await handleSupabaseEdgeError(error, 'Unable to generate search embedding.');
  }

  const embedding = normalizeEmbeddingVector((data as any)?.embedding);
  if (!embedding.length) {
    throw new Error('Invalid embedding response.');
  }
  return embedding;
}

export const narrationService = {
  async generateSearchEmbedding(queryText: string): Promise<number[]> {
    return generateQueryEmbedding(queryText);
  },

  async searchNarrationsHybrid(options: {
    queryText: string;
    queryEmbedding: number[];
    matchCount?: number;
    orgId: string;
  }): Promise<NarrationSearchResultRow[]> {
    const queryText = String(options.queryText ?? '').trim();
    if (!queryText) throw new Error('Missing query text.');

    if (!Array.isArray(options.queryEmbedding) || options.queryEmbedding.length === 0) {
      throw new Error('Missing query embedding.');
    }

    const orgId = String(options.orgId ?? '').trim();
    if (!orgId) throw new Error('Missing orgId.');

    const { data, error } = await supabase.rpc('search_narrations_hybrid', {
      query_text: queryText,
      query_embedding: options.queryEmbedding,
      match_count: options.matchCount ?? 20,
      org_id_filter: orgId,
    });

    if (error) throw error;

    return (data ?? []) as NarrationSearchResultRow[];
  },
  /**
   * Creates a new narration for a media asset segment.
   *
   * Problem it solves:
   * - Allows users to add voice/text commentary on specific video segments.
   *
   * Conceptual tables:
   * - `narrations`
   *
   * Allowed caller:
   * - Authenticated user; RLS enforces org membership and permissions.
   *
   * Implementation:
   * - Direct Supabase INSERT under RLS.
   *
   * @param input Narration creation parameters.
   * @returns The created narration.
   */
  async createNarration(input: {
    orgId: string;
    mediaAssetId: string;
    mediaAssetSegmentId: string;
    transcriptRaw: string;
    /** Optional: system/AI narrations can pass sourceType: 'ai' and authorId: null. */
    sourceType?: NarrationSourceType | null;
    authorId?: string | null;
  }): Promise<Narration> {
    const isSystemNarration = input.sourceType === 'ai' || input.authorId === null;
    let authorId: string | null = null;
    let sourceType: NarrationSourceType;

    if (isSystemNarration) {
      authorId = null;
      sourceType = 'ai';
    } else {
      authorId = input.authorId ?? requireUserId();
      // Snapshot org_members.role -> narration.source_type at creation time.
      const role = await getOrgMemberRole(input.orgId, authorId);
      sourceType = mapMembershipRoleToNarrationSourceType(role);
    }

    const row = await getSingle<NarrationRow>(
      supabase
        .from("narrations")
        .insert({
          org_id: input.orgId,
          media_asset_id: input.mediaAssetId,
          media_asset_segment_id: input.mediaAssetSegmentId,
          author_id: authorId,
          source_type: sourceType,
          transcript_raw: input.transcriptRaw,
        })
        .select("*")
        .single(),
      "Failed to create narration."
    );

    triggerNarrationEmbedding(row.id);

    return toNarration(row);
  },

  /**
   * Lists all narrations for a specific media asset segment.
   *
   * Problem it solves:
   * - Displays existing commentary on a segment.
   *
   * Conceptual tables:
   * - `narrations`
   *
   * Allowed caller:
   * - Authenticated user; RLS enforces visibility.
   *
   * Implementation:
   * - Direct Supabase SELECT under RLS.
   *
   * @param segmentId The media asset segment ID.
   * @returns List of narrations for the segment.
   */
  async listNarrationsForSegment(segmentId: string): Promise<Narration[]> {
    const rows = await getList<NarrationRow>(
      supabase
        .from("narrations")
        .select("*")
        .eq("media_asset_segment_id", segmentId)
        .order("created_at", { ascending: true })
    );

    return rows.map(toNarration);
  },

  /**
   * Lists all narrations for a media asset (across all segments).
   */
  async listNarrationsForMediaAsset(mediaAssetId: string): Promise<Narration[]> {
    if (!mediaAssetId) return [];

    const rows = await getList<NarrationRow>(
      supabase
        .from('narrations')
        .select('*')
        .eq('media_asset_id', mediaAssetId)
        .order('created_at', { ascending: true })
    );

    return rows.map(toNarration);
  },

  /**
   * Updates the raw transcript text for an existing narration.
   *
   * Authorization:
   * - Enforced via Supabase RLS.
   * - Typical policy is: author can update own narration.
   */
  async updateNarrationText(narrationId: string, transcriptRaw: string): Promise<Narration> {
    const data = await getSingle<NarrationRow>(
      supabase
        .from('narrations')
        .update({ transcript_raw: transcriptRaw })
        .eq('id', narrationId)
        .select('*')
        .single(),
      'Failed to update narration.'
    );

    triggerNarrationEmbedding(data.id);

    return toNarration(data);
  },

  /**
   * Deletes an existing narration.
   *
   * Authorization:
   * - Enforced via Supabase RLS.
   * - Typical policies are: author can delete own narration; org managers may delete within org.
   */
  async deleteNarration(narrationId: string): Promise<void> {
    const { error } = await supabase
      .from('narrations')
      .delete()
      .eq('id', narrationId);

    if (error) throw error;
  },
};

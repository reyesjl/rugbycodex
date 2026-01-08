import { supabase } from "@/lib/supabaseClient";
import { requireUserId } from "@/modules/auth/identity";
import type { Narration } from "../types/Narration";
import type { PostgrestError } from "@supabase/supabase-js";

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
  audio_storage_path: string | null;
  transcript_raw: string;
  transcript_clean: string | null;
  transcript_lang: string | null;
  created_at: string | Date;
  updated_at: string | Date;
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

function toNarration(row: NarrationRow): Narration {
  return {
    id: row.id,
    org_id: row.org_id,
    media_asset_id: row.media_asset_id,
    media_asset_segment_id: row.media_asset_segment_id,
    author_id: row.author_id,
    audio_storage_path: row.audio_storage_path,
    transcript_raw: row.transcript_raw,
    transcript_clean: row.transcript_clean,
    transcript_lang: row.transcript_lang,
    created_at: asDate(row.created_at, "created_at"),
    updated_at: asDate(row.updated_at, "updated_at"),
  };
}

export const narrationService = {
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
  }): Promise<Narration> {
    const userId = requireUserId();

    const data = await getSingle<NarrationRow>(
      supabase
        .from("narrations")
        .insert({
          org_id: input.orgId,
          media_asset_id: input.mediaAssetId,
          media_asset_segment_id: input.mediaAssetSegmentId,
          author_id: userId,
          transcript_raw: input.transcriptRaw,
        })
        .select("*")
        .single(),
      "Failed to create narration."
    );

    return toNarration(data);
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
};

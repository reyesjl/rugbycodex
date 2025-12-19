import type { Profile } from "./Profile";

/**
 * Immutable audit record for XP changes.
 *
 * Conceptual source:
 * - `profile_xp_events` (or similar append-only ledger)
 */
export type XPHistoryEntry = {
  id: string;
  profile_id: Profile["id"];
  delta: number;
  xp_after: number;
  reason: string;
  created_at: Date;
  actor_profile_id: Profile["id"] | null;
  metadata: Record<string, unknown> | null;
};


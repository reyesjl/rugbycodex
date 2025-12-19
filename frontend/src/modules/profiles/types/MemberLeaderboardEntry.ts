/**
 * Aggregated/derived shape used for XP leaderboards.
 *
 * This is intentionally not a raw `profiles` row.
 */
export type MemberLeaderboardEntry = {
  id: string;
  name: string;
  xp: number;
  orgCount: number;
};


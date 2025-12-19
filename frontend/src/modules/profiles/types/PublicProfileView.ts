import type { Profile } from "./Profile";

/**
 * Public-safe subset of a profile, suitable for unauthenticated reads and public pages.
 *
 * Intentionally excludes:
 * - `role` (platform authority)
 * - `primary_org` (tenant context)
 */
export type PublicProfileView = Pick<Profile, "id" | "username" | "name" | "xp" | "creation_time">;


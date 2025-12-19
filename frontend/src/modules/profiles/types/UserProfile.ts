import type { Profile } from "./Profile";

/**
 * Normalized profile shape used by legacy (v1) screens and services.
 *
 * Why not use `Profile` directly?
 * - `Profile` is the canonical module type (idealized row contract).
 * - Some legacy endpoints historically treated `xp` as nullable; this type
 *   preserves that compatibility without redefining every profile field.
 */
export type UserProfile = Omit<Profile, "xp"> & {
  xp: number | null;
};


import type { Profile } from "./Profile";

export type ActiveProfileContextSource = "profile.primary_org" | "explicit" | "none";

/**
 * Minimal, org-agnostic context derived from a profile.
 *
 * Note:
 * - This type intentionally carries ONLY organization identifiers.
 * - Resolved organization details and membership permissions belong to org services.
 */
export type ActiveProfileContext = {
  profile: Profile;
  activeOrgId: Profile["primary_org"];
  source: ActiveProfileContextSource;
};


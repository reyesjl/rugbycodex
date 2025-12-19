import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import { isPlatformAdmin, requireAuthUser, requireUserId } from "@/modules/auth/identity";
import type { ActiveProfileContext, Profile, PublicProfileView, XPHistoryEntry } from "../types";

/**
 * Service layer for profile data access and mutation.
 *
 * Responsibility:
 * - Encapsulates all profile-related I/O.
 * - Enforces intent-based update boundaries (self vs admin/system).
 *
 * This service does NOT:
 * - Hold state
 * - Perform permission checks beyond API shape
 * - Derive UI logic
 *
 * Authorization is enforced via Supabase RLS and Edge Functions.
 */
export const profileService = {
    // ===========================================================================
    // Initialization & Identity
    // ===========================================================================

    /**
     * Ensures the current authenticated user has a corresponding `profiles` row.
     *
     * Problem it solves:
     * - Prevents "new auth user with no profile row" states that break dashboards,
     *   onboarding, and any downstream profile-dependent reads.
     *
     * Conceptual tables:
     * - `auth.users` (source of identity, not queried directly from the client)
     * - `profiles`
     *
     * Allowed caller:
     * - Authenticated user (self).
     *
     * Implementation:
     * - Direct Supabase calls under RLS (preferred).
     * - Uses INSERT + unique constraints to handle concurrency safely.
     *
     * @returns The ensured profile row.
     */
    async ensureProfileInitialized(): Promise<Profile> {
        const userId = requireUserId();
        const user = requireAuthUser();

        // profile exists
        const existing = await this.getMyProfile();
        if (existing) return existing;

        let username = this._deriveUsernameFromAuth(user);
        const name = this._deriveNameFromAuth(user);

        // Attempt insert
        try {
            const { error } = await supabase.from("profiles").insert({
                id: userId,
                name,
                username,
            });

            if (error) throw error;
        } catch (err: any) {
            const msg = err?.message?.toLowerCase?.() ?? "";

            // Username conflict → deterministic fallback + retry ONCE
            if (msg.includes("duplicate") || msg.includes("unique")) {
                username = `${username}-1`;

                const { error } = await supabase.from("profiles").insert({
                    id: userId,
                    name,
                    username,
                });

                if (error) {
                    // if this ALSO fails, yield to truth of database state
                    throw error;
                }
            }

            // If ID conflict happens, it means someone else won the race
            // so we just move on and read canonical truth
        }

        // Return canonical database truth
        const created = await this.getMyProfile();
        if (!created) {
            throw new Error("Failed to initialize profile; database returned no row.");
        }

        return created;
    },

    /**
     * Creates a profile row from an authenticated Supabase user object.
     *
     * Problem it solves:
     * - Centralizes the mapping from auth identity -> `profiles` row creation for
     *   signup flows and first-login initialization.
     *
     * Conceptual tables:
     * - `profiles`
     *
     * Allowed caller:
     * - Authenticated user creating their own profile (self) under RLS.
     *
     * Implementation:
     * - Direct Supabase INSERT under RLS (preferred).
     *
     * @param user Supabase auth user object (must represent the current session user).
     * @param input Optional self-owned seed fields (must be sanitized/normalized).
     */
    async createProfileFromAuthUser(
        user: User,
        input?: Partial<Pick<Profile, "name" | "username" >>
    ): Promise<Profile> {
        const userId = requireUserId();

        if (user.id !== userId) {
            throw new Error("Cannot create profile for a different user ID.");
        }

        const username =
            input?.username
            ? this._normalizeUsername(input.username)
            : this._deriveUsernameFromAuth(user);

        const name =
            (input?.name ?? this._deriveNameFromAuth(user)).trim();
        
        const { data, error } = await supabase.from("profiles")
            .insert({
                id: user.id,
                name: name,
                username: username,
            })
            .select("*")
            .single();

        if (error) {
            throw error;
        }

        return data;
    },

    /**
     * Checks whether a username is available.
     *
     * Problem it solves:
     * - Enables signup/profile-edit flows to validate handle availability before attempting
     *   a write that would fail on a unique constraint.
     *
     * Conceptual tables:
     * - `profiles`
     *
     * Allowed caller:
     * - Authenticated or unauthenticated user (read-only).
     *
     * Implementation:
     * - Prefer RPC (`is_username_available`) when anonymous availability checks are required.
     * - Otherwise can use direct SELECT under RLS (authenticated contexts).
     * 
     * @param username Desired username handle.
     * @returns `true` if available, `false` if taken.
     */
    async isUsernameAvailable(username: Profile["username"]): Promise<boolean> {
        if (!username || typeof username !== "string") return false;

        // Normalize first
        const normalized = username.trim().toLowerCase().replace(/^@/, "");

        const { data, error } = await supabase
            .rpc("is_username_available", {
            p_username: normalized
            })
            .single();

        if (error) {
            // Fail loud in dev, fail safe in prod
            console.error("is_username_available RPC failed", error);
            throw error;
        }

        return Boolean(data);
    },

    // ===========================================================================
    // Profile Retrieval
    // ===========================================================================

    // ===========================================================================
    // Context & Resolution
    // ===========================================================================
    
    /**
     * Returns the profile for the currently authenticated user.
     *
     * Problem it solves:
     * - Powers identity display, onboarding state, dashboard personalization,
     *   and role-based access decisions.
     *
     * Conceptual tables:
     * - `profiles`
     *
     * Allowed caller:
     * - Authenticated user; scoped to their own profile via RLS.
     *
     * Implementation:
     * - Direct Supabase SELECT.
     * - Uses implicit `auth.uid()` scoping via RLS.
     *
     * Edge cases:
     * - Returns `null` if the profile does not yet exist (new user).
     *
     * @returns The current user's profile, or null if not created yet.
     */
    async getMyProfile(): Promise<Profile | null> {
        const userId = requireUserId();

        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

        if (error) {
            // PostgREST "no rows returned"
            if (error.code === "PGRST116") return null;
            throw error;
        }

        return data;
    },

    /**
     * Retrieves a profile by ID.
     *
     * Problem it solves:
     * - Enables linking to a known profile (invites, audit trails, admin tooling),
     *   while respecting RLS visibility rules.
     *
     * Conceptual tables:
     * - `profiles`
     *
     * Allowed caller:
     * - Authenticated user; visibility is enforced by RLS policies.
     *
     * Implementation:
     * - Direct Supabase SELECT under RLS.
     * 
     * @param profileId Target profile UUID.
     * @returns The profile or null if not found.
     */
    async getProfileById(profileId: Profile["id"]): Promise<Profile | null> {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", profileId)
            .single();

        if (error) {
            // PGRST116 = "No rows returned"
            if (error.code === "PGRST116") return null;

            // Any other error = real failure
            throw error;
        }

        return data;
    },

    /**
     * Retrieves a profile by username (handle).
     *
     * Problem it solves:
     * - Supports route-driven profile pages (e.g. `/@username`) and lookup flows.
     *
     * Conceptual tables:
     * - `profiles`
     *
     * Allowed caller:
     * - Authenticated user; visibility is enforced by RLS policies.
     *
     * Implementation:
     * - Direct Supabase SELECT under RLS.
     * 
     * @param username Username handle (case-insensitive).
     * @returns The profile or null if not found.
     */
    async getProfileByUsername(username: Profile["username"]): Promise<Profile | null> {
        if (!username || typeof username !== "string") return null;

        // Normalize first
        const normalized = username.trim().toLowerCase().replace(/^@/, "");

        const {data, error } = await supabase
            .from("profiles")
            .select("*")
            .ilike("username", normalized)
            .single();

        if (error) {
            // PGRST116 = "No rows returned"
            if (error.code === "PGRST116") return null;
            throw error;
        }

        return data;
    },

    // ===========================================================================
    // Profile Updates
    // ===========================================================================

    // ===========================================================================
    // User-Owned Profile Updates
    // ===========================================================================

    /**
     * Updates mutable fields on the current user's profile.
     *
     * Problem it solves:
     * - Allows users to manage their own identity (name, username, primary org).
     *
     * Conceptual tables:
     * - `profiles`
     *
     * Allowed caller:
     * - Authenticated user; may only update their own profile.
     *
     * Security model:
     * - RLS enforces `auth.uid() = profiles.id`.
     * - RLS prevents modification of restricted fields (e.g. role, xp).
     *
     * Implementation:
     * - Direct Supabase UPDATE scoped to `auth.uid()`.
     *
     * Fields intentionally excluded:
     * - `role`
     * - `xp`
     * - `id`
     * - `creation_time`
     *
     * @param updates Partial profile fields the user is allowed to modify.
     */
    async updateMyProfile(updates: Pick<Profile, "name" | "username" | "primary_org">): Promise<void> {
        // TODO: Make into edge function for security reasons
        const userId = requireUserId();

        const { error } = await supabase
            .from("profiles")
            .update(updates)
            .eq("id", userId);

        if (error) throw error;
    },

    /**
     * Updates the user's username (handle).
     *
     * Problem it solves:
     * - Allows users to claim/change a global handle used in URLs and mentions.
     *
     * Conceptual tables:
     * - `profiles`
     *
     * Allowed caller:
     * - Authenticated user (self) under RLS.
     *
     * Implementation:
     * - Direct Supabase UPDATE under RLS.
     * - Uniqueness is enforced by the database constraint (`profiles_username_key`).
     *
     * @param username Desired username handle.
     */
    async updateUsername(username: Profile["username"]): Promise<void> {
        const userId = requireUserId();

        const normalized = this._normalizeUsername(username);
        const { error } = await supabase
            .from("profiles")
            .update({ username: normalized })
            .eq("id", userId);
        
        if (error) {
            throw error;
        }

        return;
    },

    /**
     * Updates the user's canonical name field.
     *
     * Problem it solves:
     * - Provides a stable API name for updating `profiles.name` (full name / display name).
     *
     * Conceptual tables:
     * - `profiles`
     *
     * Allowed caller:
     * - Authenticated user (self) under RLS.
     *
     * Implementation:
     * - Direct Supabase UPDATE under RLS.
     *
     * @param name Full/canonical name to store in `profiles.name`.
     */
    async updateName(name: Profile["name"]): Promise<void> {
        const userId = requireUserId();

        const { error } = await supabase
            .from("profiles")
            .update({ name: name.trim() })
            .eq("id", userId);
        
        if (error) {
            throw error;
        }

        return;
    },

    /**
     * Sets the user's primary organization context.
     *
     * Problem it solves:
     * - Allows users to declare a preferred tenant context for default routing and dashboards.
     *
     * Conceptual tables:
     * - `profiles` (`primary_org`)
     * - `organizations` (FK constraint only; this service does not query orgs)
     *
     * Allowed caller:
     * - Authenticated user (self) under RLS.
     *
     * Implementation:
     * - Direct Supabase UPDATE under RLS.
     *
     * @param orgId Organization UUID to set as primary context.
     */
    async setPrimaryOrg(orgId: NonNullable<Profile["primary_org"]>): Promise<void> {
        const userId = requireUserId();

        const { error } = await supabase
            .from("profiles")
            .update({ primary_org: orgId })
            .eq("id", userId);

        if (error) {
            throw error;
        }

        return;
    },

    /**
     * Clears the user's primary organization context.
     *
     * Problem it solves:
     * - Allows users to return to a neutral/no-default-tenant state (e.g. when leaving all orgs).
     *
     * Conceptual tables:
     * - `profiles` (`primary_org`)
     *
     * Allowed caller:
     * - Authenticated user (self) under RLS.
     *
     * Implementation:
     * - Direct Supabase UPDATE under RLS.
     * 
     */
    async clearPrimaryOrg(): Promise<void> {
        const userId = requireUserId();

        const { error } = await supabase
            .from("profiles")
            .update({ primary_org: null })
            .eq("id", userId);
        
        if (error) {
            throw error;
        }
    },

    // ===========================================================================
    // Primary Org Context
    // ===========================================================================

    /**
     * Returns the current user's `primary_org` value.
     *
     * Problem it solves:
     * - Provides a single intent-based API for reading the user's preferred tenant context.
     *
     * Conceptual tables:
     * - `profiles`
     *
     * Allowed caller:
     * - Authenticated user (self) under RLS.
     *
     * Implementation:
     * - Direct Supabase SELECT under RLS via `getMyProfile()`.
     * 
     * @returns The user's primary organization ID, or null if none is set.
     */
    async getPrimaryOrg(): Promise<Profile["primary_org"]> {
        const profile = await this.getMyProfile();

        if (!profile) {
            throw new Error("Profile not found; cannot retrieve primary organization.");
        }

        return profile.primary_org;
    },

    /**
     * Resolves a minimal "active profile context" for the current user.
     *
     * Problem it solves:
     * - Provides a stable decision point for "which org context should the UI/services assume"
     *   without pulling organization membership data into the profile layer.
     *
     * Conceptual tables:
     * - `profiles` (source of `primary_org`)
     *
     * Allowed caller:
     * - Authenticated user (self).
     *
     * Implementation:
     * - Direct RLS read of the user's profile, plus caller-provided hints.
     * 
     * @param opts Optional explicit org override (e.g., from route params).
     * @returns Active profile context including source of truth.
     */
    async resolveActiveProfileContext(opts?: { explicitOrgId?: Profile["primary_org"] | null }): Promise<ActiveProfileContext> {
        const profile = await this.getMyProfile();

        if (!profile) {
            throw new Error("Profile not found; cannot resolve active profile context.");
        }

        // Prefer explicit org if provided
        if (opts?.explicitOrgId) {
            return {
            profile,
            activeOrgId: opts.explicitOrgId,
            source: "explicit",
            };
        }

        // Fall back to profile.primary_org
        if (profile.primary_org) {
            return {
            profile,
            activeOrgId: profile.primary_org,
            source: "profile.primary_org",
            };
        }

        // No org context
        return {
            profile,
            activeOrgId: null,
            source: "none",
        };
    },

    // ===========================================================================
    // XP / Reputation System
    // ===========================================================================

    /**
     * Increments XP for a target profile.
     *
     * Problem it solves:
     * - Awards XP for trusted events (e.g., match uploads, verified analysis contributions).
     *
     * Conceptual tables:
     * - `profiles` (updates `xp`)
     * - `profile_xp_events` (append-only ledger; future/audit)
     *
     * Allowed caller:
     * - System automation / platform admin only.
     *
     * Implementation:
     * - Edge Function (privileged).
     */
    async incrementXP(params: { profileId: Profile["id"]; delta: number; reason: string }): Promise<Profile> {
        // TODO implementation plan:
        // 1. Validate inputs (`profileId`, `delta`, `reason`).
        // 2. Invoke Edge Function (e.g., `profiles-increment-xp`) with payload.
        // 3. Edge function validates authority, writes ledger, and increments xp.
        // 4. Return updated profile.
        void params;
        throw new Error("Not implemented");
    },

    /**
     * Sets XP to an explicit value for a target profile.
     *
     * Problem it solves:
     * - Supports admin correction, moderation, and migration/repair tooling.
     *
     * Conceptual tables:
     * - `profiles` (updates `xp`)
     * - `profile_xp_events` (append-only ledger; future/audit)
     *
     * Allowed caller:
     * - Platform admin only.
     *
     * Implementation:
     * - Edge Function (privileged).
     */
    async setXP(params: { profileId: Profile["id"]; xp: Profile["xp"]; reason: string }): Promise<Profile> {
        // TODO implementation plan:
        // 1. Validate inputs (`profileId`, `xp`, `reason`).
        // 2. Invoke Edge Function (e.g., `profiles-set-xp`) with payload.
        // 3. Edge function validates platform authority, writes ledger, and sets xp.
        // 4. Return updated profile.
        void params;
        throw new Error("Not implemented");
    },

    /**
     * Returns XP change history for a profile.
     *
     * Problem it solves:
     * - Enables transparency and debugging of XP accrual (audit trail).
     *
     * Conceptual tables:
     * - `profile_xp_events` (future)
     *
     * Allowed caller:
     * - Profile owner (self) and/or platform admin depending on RLS policy.
     *
     * Implementation:
     * - Prefer direct Supabase SELECT under RLS if a ledger table exists.
     * - Use Edge Function only if cross-user access must be privileged.
     */
    async getXPHistory(profileId: Profile["id"]): Promise<XPHistoryEntry[]> {
        // TODO implementation plan:
        // 1. Validate `profileId`.
        // 2. Decide access path:
        //    - self-only: direct SELECT under RLS
        //    - admin/cross-user: Edge function proxy
        // 3. Query ledger table ordered by `created_at desc`.
        // 4. Map rows into `XPHistoryEntry[]` (ensure Dates are parsed).
        void profileId;
        throw new Error("Not implemented");
    },

    // ===========================================================================
    // Platform Role Awareness
    // ===========================================================================

    /**
     * Returns whether the current user has platform-admin authority.
     *
     * Problem it solves:
     * - Allows UI and client workflows to gate privileged affordances without
     *   mixing in organization permissions.
     *
     * Source of truth:
     * - Supabase JWT (claims.user_role === 'admin').
     *   This value is cryptographically signed and cannot be forged client-side.
     *
     * Allowed caller:
     * - Any authenticated user.
     *
     * Implementation:
     * - Reads the decoded JWT-derived identity state (no database calls).
     * @returns `true` if the user is a platform admin.
     */
    async isPlatformAdmin(): Promise<boolean> {
        const isAdmin =  isPlatformAdmin();
        return isAdmin;
    },

    /**
     * Ensures the current user has platform-admin authority.
     *  
     * Problem it solves:
     * - Provides a stable gate for client flows that require elevated privileges.
     * 
     * Source of truth:
     * - Supabase JWT (claims.user_role === 'admin').
     * 
     * Allowed caller:
     * - Any authenticated user.
     * 
     * Implementation:
     * - Reads the decoded JWT-derived identity state (no database calls).
     */
    async requirePlatformAdmin(): Promise<void> {
        const isAdmin = await isPlatformAdmin()
        if (!isAdmin) {
            throw new Error("Forbidden: requires platform admin");
        }

        return;
    },

    // ===========================================================================
    // Public Identity Exposure
    // ===========================================================================

    /**
     * Returns a public-safe view of a profile by ID.
     *
     * Problem it solves:
     * - Supports public profile pages, mentions, and lightweight identity display where
     *   platform authority and tenant context must not be exposed.
     *
     * Conceptual tables:
     * - `profiles` (limited columns) OR a dedicated view like `public_profiles`
     *
     * Allowed caller:
     * - Any user (including anonymous), depending on RLS/view policy.
     *
     * Implementation:
     * - Prefer direct Supabase SELECT against a dedicated public view under RLS.
     * - Use Edge Function only if the public policy must be enforced server-side with extra logic.
     *
     * @param profileId Target profile UUID.
     * @returns Public profile view or null if not found.
     */
    async getPublicProfile(profileId: Profile["id"]): Promise<PublicProfileView | null> {
        const { data, error } = await supabase
            .from("public_profiles")
            .select("id, username, name, xp, creation_time")
            .eq("id", profileId)
            .single();

        if (error) {
            // PGRST116 = "No rows returned"
            if (error.code === "PGRST116") return null;
            throw error;
        }

        return data;
    },

    /**
     * Returns a public-safe view of a profile by username.
     *
     * Problem it solves:
     * - Supports `/@username` public profile routes.
     *
     * Conceptual tables:
     * - `profiles` (limited columns) OR `public_profiles` view
     *
     * Allowed caller:
     * - Any user (including anonymous), depending on RLS/view policy.
     *
     * Implementation:
     * - Prefer direct Supabase SELECT against a public view.
     * 
     * @param username Username handle.
     * @returns Public profile view or null if not found.
     */
    async getPublicProfileByUsername(username: Profile["username"]): Promise<PublicProfileView | null> {
        if (!username || typeof username !== "string") return null;

        // Normalize first
        const normalized = username.trim().toLowerCase().replace(/^@/, "");

        const { data, error } = await supabase
            .from("public_profiles")
            .select("id, username, name, xp, creation_time")
            .eq("username", normalized)
            .single();

        if (error) {
            // PGRST116 = "No rows returned"
            if (error.code === "PGRST116") return null;
            throw error;
        }

        return data;
    },

    // ===========================================================================
    // Account Completeness & Onboarding
    // ===========================================================================

    /**
     * Returns whether a profile meets the platform's "complete" threshold.
     *
     * Problem it solves:
     * - Allows onboarding flows to determine when to stop prompting for required identity fields.
     *
     * Conceptual tables:
     * - `profiles` (read-only; purely derived from the row)
     *
     * Allowed caller:
     * - Any caller with access to the `Profile` object (pure function).
     *
     * Implementation:
     * - No I/O; purely derived from the provided profile.
     * @param profile Profile to evaluate.
     * @returns `true` if complete, `false` if incomplete.
     */
    isProfileComplete(profile: Profile): boolean {
        if (!profile) return false;

        // Example rules (can be expanded as needed)
        const hasValidUsername =
            typeof profile.username === "string" &&
            profile.username.trim().length >= 3;

        const hasValidName =
            typeof profile.name === "string" &&
            profile.name.trim().length >= 1;

        const hasPrimaryOrg = profile.primary_org !== null;

        return hasValidUsername && hasValidName && hasPrimaryOrg;
    },

    /**
     * Returns a list of messages indicating which profile fields are incomplete.
     *
     * Problem it solves:
     * - Provides user-friendly feedback during onboarding/profile completion flows.
     *
     * Conceptual tables:
     * - `profiles` (read-only; purely derived from the row)
     *
     * Allowed caller:
     * - Any caller with access to the `Profile` object (pure function).
     * 
     * Implementation:
     * - No I/O; purely derived from the provided profile.
     * @param profile Profile to evaluate.
     * @returns Array of completion messages.
     */
    getProfileCompletionMessages(profile: Profile | null | undefined): string[] {
        if (!profile) return ["Profile is missing"];

        const messages: string[] = [];

        const username =
            typeof profile.username === "string"
            ? profile.username.trim()
            : "";

        const name =
            typeof profile.name === "string"
            ? profile.name.trim()
            : "";

        if (!username) {
            messages.push("Please choose a username");
        } else if (username.length < 3) {
            messages.push("Your username must be at least 3 characters");
        }

        if (!name) {
            messages.push("Please enter your name");
        }

        if (profile.primary_org === null || profile.primary_org === undefined) {
            messages.push("Select a primary organization");
        }

        return messages;
    },

    /**
     * Returns whether the current user should be routed into onboarding.
     *
     * Problem it solves:
     * - Provides a single policy decision for dashboards/routers to decide
     *   whether the user needs identity completion.
     *
     * Conceptual tables:
     * - `profiles`
     *
     * Allowed caller:
     * - Authenticated user (self).
     *
     * Implementation:
     * - Typically: `getMyProfile()` + `isProfileComplete()`.
     *
     * Expected behavior:
     * - Returns `true` if profile is missing OR incomplete.
     *
     * Return contract:
     * - `boolean`
     *
     * Failure conditions:
     * - Supabase read failures.
     *
     * Dangerous pitfalls:
     * - Do not treat "missing profile" as a hard error; onboarding may need to initialize it.
     */
    async needsOnboarding(): Promise<boolean> {
        const profile = await this.getMyProfile();

        // Profile doesn't exist yet
        if (!profile) return true;

        // Profile exists but isn't complete
        return !this.isProfileComplete(profile);
    },

    // ===========================================================================
    // Admin / Platform Operations
    // ===========================================================================

    /**
     * Updates privileged fields on a user's profile.
     *
     * Problem it solves:
     * - Enables admin tooling and system automation
     *   (role changes, XP adjustments, moderation).
     *
     * Conceptual tables:
     * - `profiles`
     *
     * Allowed caller:
     * - Platform admin; enforced server-side.
     *
     * Implementation:
     * - Edge Function (privileged)
     *
     * @param userId Target user ID.
     * @param updates Privileged fields to update.
     */
    async adminUpdateProfile(userId: string, updates: Pick<Profile, "role" | "xp">): Promise<void> {
        // TODO implementation plan:
        // 1. Validate inputs (`userId`, `updates`).
        // 2. Invoke Edge Function (e.g., `profiles-admin-update`) with payload.
        // 3. Edge function validates platform authority and performs update.
        void userId;
        void updates;
        throw new Error("Not implemented");
    },

    // ===========================================================================
    // Internal / Helpers
    // ===========================================================================

    /**
     * Normalizes a username into canonical storage format.
     *
     * Problem it solves:
     * - Ensures all username reads/writes use the same transformation rules.
     *
     * Conceptual tables:
     * - `profiles` (`username`)
     *
     * Allowed caller:
     * - Internal use only.
     *
     * Implementation:
     * - Pure function; no I/O.
     */
    _normalizeUsername(username: string): string {
        return username.trim().replace(/^@+/, "").toLowerCase();
    },

    /**
     * Derives a default username from auth user info.
     *
     * Problem it solves:
     * - Provides a deterministic fallback username during profile initialization.
     * @param user 
     * @returns 
     */
    _deriveUsernameFromAuth(user: User): string {
        const id = user.id?.replace(/-/g, "").toLowerCase();

        if (!id || id.length < 8) {
            // absolute worst-case fallback, still deterministic
            return `rcx-${crypto.randomUUID().slice(0, 8)}`;
        }

        return `rcx-${id.slice(0, 8)}`;
    },

    /**
     * Derives a display name from auth user info.
     * 
     * Problem it solves:
     * - Provides a friendly default name during profile initialization.
     * @param user 
     * @returns 
     */
    _deriveNameFromAuth(user: User): string {
    const name =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split("@")[0] ??
        "";

    return String(name).trim();
    },
};

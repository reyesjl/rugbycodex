import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "../types/Profile";

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
    const { data, error } = await supabase.from("profiles").select("*").single();

    if (error) {
        // PostgREST "no rows returned"
        if (error.code === "PGRST116") return null;
        throw error;
    }

    return data;
    },

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
        const { error } = await supabase.from("profiles").update(updates);

        if (error) throw error;
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
        throw new Error("Not implemented: Use Edge Function for admin profile updates.");
    },
};

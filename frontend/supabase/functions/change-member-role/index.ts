import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { getAuthContext } from "../_shared/auth.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { withObservability } from "../_shared/observability.ts";

/**
 * Role hierarchy definition: member < staff < manager < owner
 * Lower rank = lower privilege
 */
const ROLE_RANK = {
  member: 0,
  staff: 1,
  manager: 2,
  owner: 3,
} as const;

type OrgRole = keyof typeof ROLE_RANK;

const VALID_ROLES = ["member", "staff", "manager", "owner"] as const;

serve(withObservability("change-member-role", async (req) => {
  try {
    // Handle CORS preflight
    const cors = handleCors(req);
    if (cors) return cors;

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: {
            code: "METHOD_NOT_ALLOWED",
            message: "Only POST requests are allowed.",
          },
        }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract caller identity from JWT
    const { userId: callerId, isAdmin } = await getAuthContext(req);
    if (!callerId) {
      return new Response(
        JSON.stringify({
          error: {
            code: "AUTH_REQUIRED",
            message: "Authentication required.",
          },
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request payload
    const { orgId, userId: targetUserId, role } = await req.json();
    if (!orgId || !targetUserId || !role) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_REQUEST",
            message: "Missing required fields: orgId, userId, and role are required.",
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role is a known value
    if (!VALID_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_ROLE",
            message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}.`,
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // =========================================================================
    // Authorization: Load caller's membership to determine their authority
    // =========================================================================
    let callerRole: OrgRole | null = null;

    if (!isAdmin) {
      // Platform admins bypass membership checks; non-admins must have membership
      const { data: callerMembership, error: callerError } = await supabase
        .from("org_members")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", callerId)
        .maybeSingle();

      if (callerError || !callerMembership) {
        return new Response(
          JSON.stringify({
            error: {
              code: "NOT_ORG_MEMBER",
              message: "You are not a member of this organization.",
            },
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      callerRole = callerMembership.role as OrgRole;

      // Authorization policy:
      // - owner: full role management authority
      // - manager: can manage roles below them
      // - staff: no role management authority (policy decision: staff are operational, not administrative)
      // - member: no role management authority
      //
      // If you want to allow staff to manage members, change this to: callerRole !== 'member'
      if (callerRole !== "owner" && callerRole !== "manager") {
        return new Response(
          JSON.stringify({
            error: {
              code: "INSUFFICIENT_PERMISSIONS",
              message: "You do not have permission to change member roles.",
            },
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // =========================================================================
    // Load target membership
    // =========================================================================
    const { data: targetMembership, error: targetError } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .single();

    if (targetError || !targetMembership) {
      return new Response(
        JSON.stringify({
          error: {
            code: "TARGET_NOT_FOUND",
            message: "Target user is not a member of this organization.",
          },
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const targetRole = targetMembership.role as OrgRole;

    // =========================================================================
    // No-op check: reject if target already has the requested role
    // =========================================================================
    if (targetRole === role) {
      return new Response(
        JSON.stringify({
          error: {
            code: "NO_CHANGE_NEEDED",
            message: `User already has the role: ${role}.`,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // =========================================================================
    // Role hierarchy enforcement (non-admin callers only)
    // =========================================================================
    if (!isAdmin && callerRole) {
      const callerRank = ROLE_RANK[callerRole];
      const targetRank = ROLE_RANK[targetRole];
      const newRoleRank = ROLE_RANK[role as OrgRole];

      // Rule 1: Caller cannot modify a target with a HIGHER role than themselves
      // Use > (not >=) to allow equal-rank modifications (e.g., manager can demote manager)
      if (targetRank > callerRank) {
        return new Response(
          JSON.stringify({
            error: {
              code: "TARGET_RANK_TOO_HIGH",
              message: "You cannot modify a user with a higher role than your own.",
            },
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Rule 2: Caller cannot assign a role higher than their own
      if (newRoleRank > callerRank) {
        return new Response(
          JSON.stringify({
            error: {
              code: "ASSIGNMENT_RANK_TOO_HIGH",
              message: "You cannot assign a role higher than your own.",
            },
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Rule 3: Only owner may assign the owner role
      if (role === "owner" && callerRole !== "owner") {
        return new Response(
          JSON.stringify({
            error: {
              code: "OWNER_ASSIGNMENT_RESTRICTED",
              message: "Only organization owners can assign the owner role.",
            },
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // =========================================================================
    // Last-owner invariant: prevent leaving org without an owner
    // =========================================================================
    const isDemotingOwner = targetRole === "owner" && role !== "owner";

    if (isDemotingOwner) {
      // Count current owners in the organization
      const { count, error: countError } = await supabase
        .from("org_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("role", "owner");

      if (countError) {
        console.error("Failed to count owners:", countError);
        return new Response(
          JSON.stringify({
            error: {
              code: "OWNER_COUNT_FAILED",
              message: "Failed to verify owner count.",
            },
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Block if this is the last owner (applies to self-demotion too)
      if (count === 1) {
        return new Response(
          JSON.stringify({
            error: {
              code: "LAST_OWNER_PROTECTION",
              message: "Cannot change role: organization must have at least one owner.",
            },
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // =========================================================================
    // Execute role update
    // =========================================================================
    const { data: updatedMembership, error: updateError } = await supabase
      .from("org_members")
      .update({ role })
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update member role:", updateError);
      return new Response(
        JSON.stringify({
          error: {
            code: "ROLE_UPDATE_FAILED",
            message: "Failed to update member role.",
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // =========================================================================
    // Fetch public profile data (use public_profiles, not profiles)
    // =========================================================================
    const { data: publicProfile, error: profileError } = await supabase
      .from("public_profiles")
      .select("id, username, name, xp")
      .eq("id", targetUserId)
      .single();

    if (profileError) {
      console.error("Failed to fetch public profile:", profileError);
      // Non-fatal: return membership without profile
      return new Response(
        JSON.stringify({
          membership: updatedMembership,
          profile: null,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // =========================================================================
    // Success response
    // =========================================================================
    return new Response(
      JSON.stringify({
        membership: updatedMembership,
        profile: publicProfile,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Unexpected error in change-member-role:", err);
    return new Response(
      JSON.stringify({
        error: {
          code: "UNEXPECTED_SERVER_ERROR",
          message: "An unexpected error occurred.",
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}));

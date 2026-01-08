import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { getAuthContext } from "../_shared/auth.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";

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

const PRIVILEGED_ROLES = ["staff", "manager", "owner"] as const;

/**
 * Generates a random 8-character alphanumeric join code
 */
function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous characters
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

serve(async (req) => {
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
    const { orgId } = await req.json();
    if (!orgId) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_REQUEST",
            message: "Missing required field: orgId is required.",
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

      const callerRole = callerMembership.role as OrgRole;

      // Authorization policy:
      // - owner: can refresh join code
      // - manager: can refresh join code
      // - staff: can refresh join code
      // - member: cannot refresh join code
      if (!PRIVILEGED_ROLES.includes(callerRole as typeof PRIVILEGED_ROLES[number])) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INSUFFICIENT_PERMISSIONS",
              message: "You do not have permission to refresh the organization join code.",
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
    // Generate and update join code
    // =========================================================================
    const newJoinCode = generateJoinCode();
    const now = new Date().toISOString();

    const { data: updatedOrg, error: updateError } = await supabase
      .from("organizations")
      .update({
        join_code: newJoinCode,
        join_code_set_at: now,
      })
      .eq("id", orgId)
      .select("join_code, join_code_set_at")
      .single();

    if (updateError || !updatedOrg) {
      console.error("Failed to refresh join code:", updateError);
      return new Response(
        JSON.stringify({
          error: {
            code: "UPDATE_FAILED",
            message: "Failed to refresh join code.",
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // =========================================================================
    // Success response
    // =========================================================================
    return new Response(
      JSON.stringify({
        joinCode: updatedOrg.join_code,
        joinCodeSetAt: updatedOrg.join_code_set_at,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Unexpected error in refresh-org-join-code:", err);
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
});

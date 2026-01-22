import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { getAuthContext } from "../_shared/auth.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import {
  allowAdminBypass,
  getUserRoleFromRequest,
  requireAuthenticated,
  requireOrgRoleSource,
  requireRole,
} from "../_shared/roles.ts";
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

const PRIVILEGED_ROLES = ["staff", "manager", "owner"] as const;

serve(withObservability("get-org-join-code", async (req) => {
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
    try {
      requireAuthenticated(callerId);
    } catch {
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
    // Authorization: Staff+ required (admin bypass)
    // =========================================================================
    let enforceRole = false;
    allowAdminBypass(isAdmin, () => {
      enforceRole = true;
    });

    if (enforceRole) {
      try {
        const { userId, role, source } = await getUserRoleFromRequest(req, { supabase, orgId });
        requireAuthenticated(userId);
        requireOrgRoleSource(source);
        requireRole(role, "staff");
      } catch (err) {
        const code = (err as any)?.code;
        if (code === "ORG_ROLE_REQUIRED") {
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
        return new Response(
          JSON.stringify({
            error: {
              code: "INSUFFICIENT_PERMISSIONS",
              message: "You do not have permission to access the organization join code.",
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
    // Fetch organization join code
    // =========================================================================
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("join_code, join_code_set_at")
      .eq("id", orgId)
      .single();

    if (orgError || !organization) {
      return new Response(
        JSON.stringify({
          error: {
            code: "ORG_NOT_FOUND",
            message: "Organization not found.",
          },
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate join code exists
    if (!organization.join_code) {
      return new Response(
        JSON.stringify({
          error: {
            code: "JOIN_CODE_NOT_AVAILABLE",
            message: "Organization does not have a join code available.",
          },
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // =========================================================================
    // Success response
    // =========================================================================
    return new Response(
      JSON.stringify({
        joinCode: organization.join_code,
        joinCodeSetAt: organization.join_code_set_at,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Unexpected error in get-org-join-code:", err);
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

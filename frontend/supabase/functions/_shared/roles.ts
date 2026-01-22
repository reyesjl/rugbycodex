import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getClientBoundToRequest } from "./auth.ts";

export type Role = "viewer" | "member" | "staff" | "manager" | "owner";

const ROLE_ORDER: Role[] = ["viewer", "member", "staff", "manager", "owner"];
const ROLE_RANK = new Map<Role, number>(
  ROLE_ORDER.map((role, index) => [role, index]),
);

export function normalizeRole(role: unknown): Role {
  const value = String(role ?? "").trim().toLowerCase();
  if (!value) return "viewer";
  if (value === "owner") return "owner";
  if (value === "manager") return "manager";
  if (value === "staff") return "staff";
  if (value === "member") return "member";
  return "viewer";
}

export function roleAtLeast(role: Role, minRole: Role): boolean {
  return (ROLE_RANK.get(role) ?? 0) >= (ROLE_RANK.get(minRole) ?? 0);
}

export function requireRole(userRole: Role, minRole: Role) {
  if (!roleAtLeast(userRole, minRole)) {
    const err = new Error(`Forbidden: requires ${minRole} role or higher.`);
    (err as any).status = 403;
    (err as any).code = "FORBIDDEN";
    throw err;
  }
}

export function requireAuthenticated(userId: string | null) {
  if (!userId) {
    const err = new Error("Unauthorized");
    (err as any).status = 401;
    (err as any).code = "UNAUTHORIZED";
    throw err;
  }
}

function extractRoleFromJwt(authHeader: string | null): Role {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return "viewer";

  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return "viewer";
    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;

    const claim =
      (payload as any)?.user_role ??
      (payload as any)?.app_metadata?.role ??
      (payload as any)?.app_metadata?.user_role ??
      (payload as any)?.user_metadata?.role ??
      (payload as any)?.user_metadata?.user_role;

    return normalizeRole(claim);
  } catch {
    return "viewer";
  }
}

export type RoleSource = "org" | "jwt" | "none";

export async function getUserRoleFromRequest(
  req: Request,
  opts?: {
    supabase?: SupabaseClient;
    orgId?: string | null;
  },
): Promise<{ userId: string | null; role: Role; source: RoleSource }> {
  console.warn("ROLE CLIENT DEBUG", {
    usingBoundClient: !!opts?.supabase,
  });
  const supabase = opts?.supabase ?? getClientBoundToRequest(req);

  const { data, error } = await supabase.auth.getUser();
  console.warn("ROLE DEBUG: auth.getUser()", {
    userId: data?.user?.id ?? null,
    hasUser: !!data?.user,
    error: error?.message,
  });
  if (error || !data?.user) {
    return { userId: null, role: "viewer", source: "none" };
  }

  const userId = data.user.id ?? null;

  if (opts?.orgId) {
    console.warn("ROLE DEBUG: org lookup start", {
      userId,
      orgId: opts?.orgId,
    });
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", opts.orgId)
      .eq("user_id", userId)
      .maybeSingle();

    console.warn("ROLE DEBUG: org lookup result", {
      userId,
      orgId: opts?.orgId,
      membershipFound: !!membership,
      rawRole: membership?.role,
    });

    if (membership?.role) {
      const role = normalizeRole(membership.role);
      const source: RoleSource = "org";
      console.warn("ROLE DEBUG: resolved role", {
        userId,
        role,
        source,
      });
      return { userId, role, source };
    }
  }

  console.warn("ROLE DEBUG: falling back to JWT role", {
    userId,
    orgId: opts?.orgId,
  });
  const roleFromJwt = extractRoleFromJwt(req.headers.get("Authorization"));
  const role = normalizeRole(roleFromJwt);
  const source: RoleSource = "jwt";
  console.warn("ROLE DEBUG: resolved role", {
    userId,
    role,
    source,
  });
  return { userId, role, source };
}

export function requireOrgRoleSource(source: "org" | "jwt" | "none") {
  console.warn("ROLE DEBUG: requireOrgRoleSource()", { source });
  if (source !== "org") {
    const err = new Error("Forbidden: org role required");
    (err as any).status = 403;
    (err as any).code = "ORG_ROLE_REQUIRED";
    throw err;
  }
}

export function allowAdminBypass(isAdmin: boolean, fn: () => void) {
  if (isAdmin) return;
  fn();
}

export function requireInternalCall(req: Request) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== Deno.env.get("INTERNAL_SECRET")) {
    const err = new Error("Forbidden: internal only");
    (err as any).status = 403;
    (err as any).code = "INTERNAL_ONLY";
    throw err;
  }
}

export function requirePlatformAdmin(isAdmin: boolean) {
  if (!isAdmin) {
    const err = new Error("Forbidden: platform admin only");
    (err as any).status = 403;
    (err as any).code = "PLATFORM_ADMIN_ONLY";
    throw err;
  }
}

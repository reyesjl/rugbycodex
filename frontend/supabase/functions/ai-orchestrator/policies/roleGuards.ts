import type { Role } from "../types.ts";

const ROLE_ORDER: Role[] = ["viewer", "member", "staff", "manager", "owner"];

const ROLE_RANK = new Map<Role, number>(ROLE_ORDER.map((role, index) => [role, index]));

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
    throw new Error(`Forbidden: requires ${minRole} role or higher.`);
  }
}

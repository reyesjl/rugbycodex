import type { MembershipRole } from "./membership";

/**
 * Organization membership display model used by legacy profile views.
 *
 * Note:
 * - This is not the raw `org_members` row shape.
 * - It includes organization display fields to avoid UI joins.
 */
export type OrgMembership = {
  org_id: string;
  org_name: string;
  slug: string;
  org_role: MembershipRole;
  join_date: Date;
};


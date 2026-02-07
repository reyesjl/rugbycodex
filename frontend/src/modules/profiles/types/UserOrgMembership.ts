export type UserOrgMembership = {
  org_id: string;
  org_name: string;
  org_slug: string;
  org_type: string;
  member_role: string;
  joined_at: Date | string;
};

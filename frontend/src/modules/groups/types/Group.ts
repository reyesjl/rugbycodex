export type OrgGroup = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type OrgGroupWithMembers = {
  group: OrgGroup;
  memberIds: string[];
};

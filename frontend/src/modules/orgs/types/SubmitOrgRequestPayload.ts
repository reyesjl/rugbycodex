import type { OrganizationType } from "./OrganizationType";

export type SubmitOrgRequestPayload = {
  requested_name: string;
  requested_type?: OrganizationType;
  message?: string | null;
};

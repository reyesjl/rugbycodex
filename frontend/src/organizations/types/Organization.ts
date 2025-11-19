/** Single organization row returned to consumers. */
export type Organization = {
  id: string;
  owner: string | null;
  slug: string;
  name: string;
  created_at: Date;
  storage_limit_mb: number;
  bio: string | null;
};

/** DTO for creating organizations programmatically. */
export type CreateOrganizationInput = {
  name: string;
  slug: string;
  owner?: string | null;
  storage_limit_mb?: number;
  bio?: string | null;
};


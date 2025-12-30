export interface DiscoverableOrganization {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  type: string | null;
  created_at: string;
}
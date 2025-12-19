import type { ProfileRole } from "./ProfileRole";
import type { UserId } from "./UserId";

export type ProfileSummary = {
  id: UserId;
  username: string;
  name: string;
  role: ProfileRole;
};

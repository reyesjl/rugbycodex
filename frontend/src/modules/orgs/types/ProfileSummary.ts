import type { UserId } from "./UserId";

export type ProfileSummary = {
  id: UserId;
  username: string;
  name: string;
  xp: number;
};

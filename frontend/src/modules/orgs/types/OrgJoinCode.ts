/**
 * OrgJoinCode
 * 
 * Represents an organization's join code with expiration tracking.
 */
export interface OrgJoinCode {
  joinCode: string;
  joinCodeSetAt: string | null;
}

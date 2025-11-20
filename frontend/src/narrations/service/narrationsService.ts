// Placeholder service for narrations-related API calls.
export const narrationsService = {
  async fetchUserNarrations(userId: string) {
    // TODO: replace with real request for user narrations.
    return { userId, narrations: [] };
  },

  async fetchOrgNarrations(orgId: string) {
    // TODO: replace with real request for organization narrations.
    return { orgId, narrations: [] };
  },
};

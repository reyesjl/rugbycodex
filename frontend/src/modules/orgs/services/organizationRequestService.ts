import type { Organization } from '@/modules/orgs/types';

type OrganizationRequestStatus = 'processing' | 'approved' | 'denied';
export type OrganizationRequestType = 'join' | 'create';

export type OrganizationRequest = {
  id: string;
  type: OrganizationRequestType;
  status: OrganizationRequestStatus;
  orgId?: string;
  requestedName?: string;
  requestedSlug?: string;
  notes?: string;
  createdAt: Date;
};

export type JoinRequestInput = {
  orgId: string;
  note?: string;
};

export type CreateRequestInput = {
  name: string;
  slug: string;
  description?: string;
};

const SIMULATED_DELAY_MS = 800;

const simulateNetworkDelay = (duration = SIMULATED_DELAY_MS) =>
  new Promise((resolve) => {
    if (typeof window !== 'undefined') {
      window.setTimeout(resolve, duration);
      return;
    }
    setTimeout(resolve, duration);
  });

const generateRequestId = () => `temp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const buildJoinPayload = (input: JoinRequestInput): OrganizationRequest => ({
  id: generateRequestId(),
  type: 'join',
  status: 'processing',
  orgId: input.orgId,
  notes: input.note,
  createdAt: new Date(),
});

const buildCreatePayload = (input: CreateRequestInput): OrganizationRequest => ({
  id: generateRequestId(),
  type: 'create',
  status: 'processing',
  requestedName: input.name,
  requestedSlug: input.slug,
  notes: input.description,
  createdAt: new Date(),
});

export const organizationRequestService = {
  /**
   * Simulates a request to join an organization.
   * Replace with a Supabase insert into `organization_requests` once the backend endpoint is ready.
   */
  async requestJoin(input: JoinRequestInput): Promise<OrganizationRequest> {
    if (!input.orgId) {
      throw new Error('An organization identifier is required.');
    }
    await simulateNetworkDelay();
    return buildJoinPayload(input);
  },

  /**
   * Simulates a request to create a new organization entry.
   * Replace with a Supabase insert into `organization_requests` once the backend endpoint is ready.
   */
  async requestCreate(input: CreateRequestInput): Promise<OrganizationRequest> {
    if (!input.name.trim() || !input.slug.trim()) {
      throw new Error('Name and slug are required.');
    }
    await simulateNetworkDelay();
    return buildCreatePayload(input);
  },

  /**
   * Helper to build the payload for tests or consumers that already have an Organization record.
   */
  toJoinInput(org: Organization, note?: string): JoinRequestInput {
    return { orgId: org.id, note };
  },
};

export type OrganizationRequestService = typeof organizationRequestService;
